import { createHash } from 'node:crypto'
import { x402Client } from '@x402/core/client'
import type { PaymentPayload, PaymentRequired } from '@x402/core/types'
import { registerExactEvmScheme } from '@x402/evm/exact/client'
import { getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { SignablePaymentTicket } from './paymentPrepareTickets.js'

export type SignedPaymentCredential = {
  signerAddress: string
  signatureHash: string
  paymentPayload: PaymentPayload
}

function normalizePrivateKey(privateKey: string): `0x${string}` {
  const normalized = privateKey.startsWith('0x')
    ? privateKey
    : `0x${privateKey}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error('invalid_x402_wallet_private_key')
  }
  return normalized as `0x${string}`
}

export async function createSignedPaymentCredential({
  ticket,
  privateKey,
  expectedAddress,
}: {
  ticket: SignablePaymentTicket
  privateKey: string
  expectedAddress: string
}): Promise<SignedPaymentCredential> {
  if (ticket.network !== 'eip155:84532') {
    throw new Error('signing_network_not_allowed')
  }

  const account = privateKeyToAccount(normalizePrivateKey(privateKey))
  if (getAddress(account.address) !== getAddress(expectedAddress)) {
    throw new Error('x402_wallet_address_mismatch')
  }

  const paymentRequired: PaymentRequired = {
    x402Version: 2,
    resource: { url: ticket.resourceUrl },
    accepts: [
      {
        scheme: 'exact',
        network: ticket.network,
        asset: ticket.asset,
        amount: ticket.amountAtomic,
        payTo: ticket.recipient,
        maxTimeoutSeconds: ticket.maxTimeoutSeconds,
        extra: {
          name: ticket.assetName,
          version: ticket.assetVersion,
        },
      },
    ],
    extensions: {},
  }

  const client = new x402Client()
  registerExactEvmScheme(client, {
    signer: account,
    networks: [ticket.network],
  })

  const paymentPayload = await client.createPaymentPayload(paymentRequired)
  const schemePayload = paymentPayload.payload as {
    signature?: string
    authorization?: { from?: string }
  }
  if (
    !schemePayload.signature ||
    !schemePayload.authorization?.from ||
    getAddress(schemePayload.authorization.from) !== getAddress(account.address)
  ) {
    throw new Error('invalid_signed_payment_payload')
  }

  return {
    signerAddress: account.address,
    signatureHash: createHash('sha256')
      .update(schemePayload.signature)
      .digest('hex'),
    paymentPayload,
  }
}
