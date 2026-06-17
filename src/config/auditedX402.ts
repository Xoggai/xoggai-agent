export const auditedX402Candidate = {
  name: 'Node4All Fortune',
  method: 'GET',
  resourceUrl:
    'https://sandbox.node4all.com/v1/x402-test?host=sandbox.node4all.com',
  network: 'eip155:84532',
  asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  recipient: '0xd275612Bf0BB35638432c4D95eAA8D5d22346Ca6',
  maxAmountAtomic: 5_000n,
  maxTimeoutSeconds: 60,
} as const
