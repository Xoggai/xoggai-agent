import { env, hasLiveX402Wallet } from '../env.js'

export type X402PayInput = {
  payTo: string
  amount: number
  currency: 'USDC'
  network: typeof env.X402_NETWORK
  paymentDetails?: unknown
}

export type X402PayOutput = {
  receipt: string
  txHash: string
}

function mockReceipt(input: X402PayInput): X402PayOutput {
  const nonce = Date.now().toString(16)
  return {
    receipt: `dev-x402-receipt:${input.network}:${input.payTo}:${input.amount}:${nonce}`,
    txHash: `0x${nonce.padEnd(64, '0').slice(0, 64)}`,
  }
}

export async function x402Pay(input: X402PayInput): Promise<X402PayOutput> {
  if (env.NODE_ENV === 'development' && !hasLiveX402Wallet()) {
    return mockReceipt(input)
  }

  const sdk = (await import('x402')) as Record<string, unknown>

  if (input.paymentDetails && typeof sdk.createPaymentHeader === 'function') {
    const [{ createWalletClient, http, publicActions }, chains, { privateKeyToAccount }] =
      await Promise.all([import('viem'), import('viem/chains'), import('viem/accounts')])
    const chain = input.network === 'base-sepolia' ? chains.baseSepolia : chains.base
    const wallet = createWalletClient({
      chain,
      transport: http(),
      account: privateKeyToAccount(env.X402_WALLET_PRIVATE_KEY as `0x${string}`),
    }).extend(publicActions)

    const details =
      input.paymentDetails &&
      typeof input.paymentDetails === 'object' &&
      'maxAmountRequired' in input.paymentDetails
        ? {
            ...(input.paymentDetails as Record<string, unknown>),
            maxAmountRequired: BigInt(
              String((input.paymentDetails as Record<string, unknown>).maxAmountRequired),
            ),
          }
        : input.paymentDetails

    const receipt = await (sdk.createPaymentHeader as (
      client: unknown,
      paymentDetails: unknown,
    ) => Promise<string>)(wallet, details)

    return {
      receipt,
      txHash: `0x${'0'.repeat(64)}`,
    }
  }

  if (typeof sdk.createX402Client === 'function') {
    const client = (sdk.createX402Client as (opts: unknown) => unknown)({
      privateKey: env.X402_WALLET_PRIVATE_KEY,
      address: env.X402_WALLET_ADDRESS,
      network: input.network,
    }) as { pay?: (opts: unknown) => Promise<X402PayOutput> }

    if (typeof client.pay === 'function') {
      return client.pay(input)
    }
  }

  if (typeof sdk.pay === 'function') {
    return (sdk.pay as (opts: unknown) => Promise<X402PayOutput>)({
      ...input,
      privateKey: env.X402_WALLET_PRIVATE_KEY,
      address: env.X402_WALLET_ADDRESS,
    })
  }

  if (env.NODE_ENV !== 'production') {
    return mockReceipt(input)
  }

  throw new Error('Installed x402 SDK does not expose a compatible payment API')
}
