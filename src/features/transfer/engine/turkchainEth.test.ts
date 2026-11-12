import { decodeFunctionData, encodeFunctionData, encodeFunctionResult, parseAbi } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { validateTurkchainEthTransfer } from './turkchainEth';
import { requireTurkchainOperationalReadiness } from './turkchainEthEvidence';

vi.mock('./turkchainEthEvidence', () => ({
  requireTurkchainOperationalReadiness: vi.fn(async () => {}),
}));

const ABI = parseAbi([
  'function transferRemote(uint32,bytes32,uint256) payable returns(bytes32)',
  'function routers(uint32) view returns(bytes32)',
  'function mailbox() view returns(address)',
  'function isolationActive() view returns(bool)',
  'function collateralRouter() view returns(address)',
  'function legacySupply() view returns(uint256)',
  'function totalSupply() view returns(uint256)',
  'function totalRedemptionCredit() view returns(uint256)',
  'function redemptionCredit(address) view returns(uint256)',
]);
const routers: Record<number, `0x${string}`> = {
  1: '0xd13d97c537620ed5762343b78534c7581ed3a2fc',
  1919: '0xbf9569b06bcb6ccf776302b0697c79b8407d8e3f',
};
const mailboxes: Record<number, string> = {
  1: '0xc005dc82818d67af737725bd4bf75435d065d239',
  1919: '0x5a1a042619aae32c5282db94769f78df93aeee6d',
};
const amount = 44_000_000_000_000n,
  legacy = 500n * 10n ** 18n,
  sender = '0x' + '11'.repeat(20),
  recipient = '0x' + '22'.repeat(20);
function fixture(source = 1919, overrides: Record<string, unknown> = {}) {
  const destination = source === 1 ? 1919 : 1,
    simulations = vi.fn();
  const providers = Object.fromEntries(
    [1, 1919].map((id) => [
      id,
      {
        getNetwork: vi.fn(async () => ({ chainId: id })),
        getBalance: vi.fn(async () => ({ toString: () => String(amount) })),
        call: vi.fn(async (tx: { from?: string; to?: string; data: `0x${string}` }) => {
          if (tx.from === routers[1] && tx.to === recipient) {
            if (overrides.recipientError) throw Error('recipient cannot receive native ETH');
            return '0x';
          }
          if (tx.from) {
            simulations(tx);
            if (overrides.simulationError) throw Error('source simulation reverted');
            return '0x';
          }
          const decoded = decodeFunctionData({ abi: ABI, data: tx.data });
          const values: Record<string, unknown> = {
            mailbox: mailboxes[id],
            routers: '0x' + routers[id === 1 ? 1919 : 1].slice(2).padStart(64, '0'),
            isolationActive: true,
            collateralRouter: routers[1],
            legacySupply: legacy,
            totalSupply: legacy + amount,
            totalRedemptionCredit: amount,
            redemptionCredit: amount,
            ...overrides,
          };
          return encodeFunctionResult({
            abi: ABI,
            functionName: decoded.functionName,
            result: values[decoded.functionName],
          } as never);
        }),
      },
    ]),
  );
  const tx = {
    to: routers[source],
    data: encodeFunctionData({
      abi: ABI,
      functionName: 'transferRemote',
      args: [destination, ('0x' + recipient.slice(2).padStart(64, '0')) as `0x${string}`, amount],
    }),
    value: source === 1 ? String(amount) : '0',
  };
  const route = {
    steps: [
      {
        chain: source,
        destChain: destination,
        type: 'bridge',
        warpRouteId: 'ETH/ethereum-turkchain',
        amountIn: String(amount),
      },
    ],
    tx,
    sourceTransactionFee: { amount: '1' },
  };
  return {
    args: {
      route,
      source,
      destination,
      sender,
      recipient,
      multiProvider: { getEthersV5Provider: vi.fn((id: number) => providers[id]) },
    } as unknown as Parameters<typeof validateTurkchainEthTransfer>[0],
    simulations,
    providers,
    tx,
  };
}
describe('isolated Ethereum–Turkchain ETH send-time validation', () => {
  beforeEach(() =>
    vi.mocked(requireTurkchainOperationalReadiness).mockReset().mockResolvedValue(undefined),
  );
  for (const id of [1, 1919])
    it('simulates exact ' + id + ' source transaction despite quoted fee', async () => {
      const f = fixture(id);
      await validateTurkchainEthTransfer(f.args);
      expect(f.simulations).toHaveBeenCalledTimes(1);
      expect(f.simulations).toHaveBeenCalledWith({ from: sender, ...f.tx });
    });
  for (const [name, override] of Object.entries({
    genesisOnly: { redemptionCredit: 0n },
    inconsistentSupply: { totalSupply: legacy },
    unbackedCredit: { totalRedemptionCredit: amount * 2n, totalSupply: legacy + amount * 2n },
    disabledIsolation: { isolationActive: false },
    wrongCollateral: { collateralRouter: routers[1919] },
    wrongMailbox: { mailbox: routers[1] },
    wrongEnrollment: { routers: '0x' + '00'.repeat(32) },
    wrongLegacy: { legacySupply: 0n },
  }))
    it('rejects ' + name + ' before simulation', async () => {
      const f = fixture(1919, override);
      await expect(validateTurkchainEthTransfer(f.args)).rejects.toThrow();
      expect(f.simulations).not.toHaveBeenCalled();
    });
  it('rejects nonpayable Ethereum recipient before source burn simulation', async () => {
    const f = fixture(1919, { recipientError: true });
    await expect(validateTurkchainEthTransfer(f.args)).rejects.toThrow('cannot receive');
    expect(f.simulations).not.toHaveBeenCalled();
  });
  it('propagates source simulation failure', async () => {
    const f = fixture(1, { simulationError: true });
    await expect(validateTurkchainEthTransfer(f.args)).rejects.toThrow('simulation reverted');
  });
  it('rejects wrong transaction router', async () => {
    const f = fixture();
    f.tx.to = routers[1];
    await expect(validateTurkchainEthTransfer(f.args)).rejects.toThrow('source router');
  });
  it('rejects wrong recipient', async () => {
    const f = fixture();
    f.args.recipient = sender;
    await expect(validateTurkchainEthTransfer(f.args)).rejects.toThrow('recipient');
  });
  it('rejects unexpected native fee on synthetic source', async () => {
    const f = fixture();
    f.tx.value = '1';
    await expect(validateTurkchainEthTransfer(f.args)).rejects.toThrow('native source fee');
  });
  it('rejects another RPC network', async () => {
    const f = fixture();
    f.providers[1].getNetwork.mockResolvedValue({ chainId: 2 });
    await expect(validateTurkchainEthTransfer(f.args)).rejects.toThrow('RPC chain');
  });
  it('missing warp route ID cannot bypass the canonical router preflight', async () => {
    const f = fixture(1919, { redemptionCredit: 0n });
    for (const step of f.args.route.steps) if (step.type === 'bridge') delete step.warpRouteId;
    await expect(validateTurkchainEthTransfer(f.args)).rejects.toThrow('redemption credit');
  });
  it('does not affect other routes', async () => {
    const f = fixture();
    f.args.route.steps = [];
    f.tx.to = ('0x' + '33'.repeat(20)) as `0x${string}`;
    await validateTurkchainEthTransfer(f.args);
    expect(f.simulations).not.toHaveBeenCalled();
  });
});

it('connection-only canonical metadata cannot bypass a wrong source router', async () => {
  const f = fixture();
  f.args.route.connection = { symbol: 'ETH', warpRouteId: 'ETH/ethereum-turkchain' };
  for (const s of f.args.route.steps) if (s.type === 'bridge') delete s.warpRouteId;
  f.tx.to = ('0x' + '33'.repeat(20)) as `0x${string}`;
  await expect(validateTurkchainEthTransfer(f.args)).rejects.toThrow('source router');
});
for (const [field, value] of [
  ['chain', 1],
  ['destChain', 1919],
  ['warpRouteId', 'USDT/ethereum-turkchain'],
] as const)
  it('rejects mismatched step ' + field, async () => {
    const f = fixture();
    const step = f.args.route.steps[0];
    if (step.type === 'bridge') Object.assign(step, { [field]: value });
    await expect(validateTurkchainEthTransfer(f.args)).rejects.toThrow('bridge step');
  });
it('readiness failure occurs before provider reads, simulation or any transfer send', async () => {
  const f = fixture();
  vi.mocked(requireTurkchainOperationalReadiness).mockRejectedValueOnce(
    Error('invalid or expired readiness'),
  );
  const send = vi.fn();
  await expect(
    (async () => {
      await validateTurkchainEthTransfer(f.args);
      await send();
    })(),
  ).rejects.toThrow('readiness');
  expect(f.args.multiProvider.getEthersV5Provider).not.toHaveBeenCalled();
  for (const p of Object.values(f.providers)) {
    expect(p.getNetwork).not.toHaveBeenCalled();
    expect(p.call).not.toHaveBeenCalled();
  }
  expect(f.simulations).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

it('rejects wrong encoded destination domain before evidence or RPC', async () => {
  const f = fixture();
  f.tx.data = encodeFunctionData({
    abi: ABI,
    functionName: 'transferRemote',
    args: [1919, ('0x' + recipient.slice(2).padStart(64, '0')) as `0x${string}`, amount],
  });
  await expect(validateTurkchainEthTransfer(f.args)).rejects.toThrow('destination domain');
  expect(f.args.multiProvider.getEthersV5Provider).not.toHaveBeenCalled();
});
it('accepts canonical connection metadata with an omitted step route ID', async () => {
  const f = fixture();
  f.args.route.connection = { symbol: 'ETH', warpRouteId: 'ETH/ethereum-turkchain' };
  for (const step of f.args.route.steps) if (step.type === 'bridge') delete step.warpRouteId;
  await validateTurkchainEthTransfer(f.args);
  expect(f.simulations).toHaveBeenCalledOnce();
});
it('rejects unsupported source chain before any provider access', async () => {
  const f = fixture();
  f.args.source = 2;
  await expect(validateTurkchainEthTransfer(f.args)).rejects.toThrow('unsupported direction');
  expect(f.args.multiProvider.getEthersV5Provider).not.toHaveBeenCalled();
});
