import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  events: [] as string[],
  early: vi.fn(),
  ready: vi.fn(),
  send: vi.fn(),
  switchNetwork: vi.fn(),
  prepare: vi.fn(),
  post: vi.fn(),
  invalidate: vi.fn(),
  update: vi.fn(),
  setRoute: vi.fn(),
  setState: vi.fn(),
}));
vi.mock('react', () => ({ useCallback: (fn: unknown) => fn, useState: () => [false, m.setState] }));
vi.mock('@hyperlane-xyz/sdk', () => ({
  ProviderType: { EthersV5: 'ethers-v5' },
  EvmTokenAdapter: class {},
  HyperlaneCore: {},
  MultiProtocolCore: {},
}));
vi.mock('@hyperlane-xyz/widgets/walletIntegrations/multiProtocol', () => ({
  useTransactionFns: () => ({
    ethereum: { switchNetwork: m.switchNetwork, sendTransaction: m.send },
  }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: m.invalidate }),
}));
vi.mock('../../chains/hooks', () => ({
  useMultiProvider: () => ({
    tryGetChainName: (id: number) => (id === 1 ? 'ethereum' : 'turkchain'),
    tryGetProtocol: () => 'ethereum',
  }),
}));
vi.mock('../../store', () => ({
  useStore: (select: (s: unknown) => unknown) =>
    select({
      chainAddresses: {},
      updateTransferTransactionStatus: m.update,
      setTransferRoute: m.setRoute,
    }),
}));
vi.mock('../../analytics/refiner', () => ({ refinerIdentifyAndShowTransferForm: vi.fn() }));
vi.mock('../../analytics/utils', () => ({
  getAnalyticsChains: vi.fn(),
  getAnalyticsToken: vi.fn(),
  trackEvent: vi.fn(),
}));
vi.mock('../../../utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../routeSecurity/validateWarpRoute', () => ({ isBridgeOnlyRoute: () => true }));
vi.mock('./turkchainEth', () => ({
  isTurkchainEthRoute: () => true,
  validateTurkchainEthTransfer: m.early,
}));
vi.mock('./turkchainEthEvidence', () => ({ requireTurkchainOperationalReadiness: m.ready }));
vi.mock('./routeTransactions', () => ({ prepareRouteTransaction: m.prepare }));
vi.mock('./ccs', () => ({ postCommitment: m.post }));
vi.mock('../relayApi', () => ({ submitToRelayApi: vi.fn() }));

import { useTransfer } from './useTransfer';

function args() {
  return {
    transactionId: 'test-only',
    route: {
      raw: {
        steps: [{ type: 'bridge' }],
        connection: { warpRouteId: 'ETH/ethereum-turkchain' },
        tx: { to: '0x' + '11'.repeat(20), data: '0x', value: '0' },
        callCommitment: { test: true },
      },
    },
    srcChainId: 1919,
    dstChainId: 1,
    sender: '0x' + '22'.repeat(20),
    recipient: '0x' + '33'.repeat(20),
    srcToken: 'ETH',
    dstToken: 'ETH',
    amount: '0.000044',
    srcTokenSymbol: 'ETH',
    dstTokenSymbol: 'ETH',
    isNative: true,
    approvalPlan: null,
  } as unknown as Parameters<ReturnType<typeof useTransfer>['execute']>[0];
}
beforeEach(() => {
  vi.clearAllMocks();
  m.events.length = 0;
  m.early.mockImplementation(async () => {
    m.events.push('early');
  });
  m.switchNetwork.mockImplementation(async () => {
    m.events.push('network');
  });
  m.post.mockImplementation(async () => {
    m.events.push('ccs');
  });
  m.prepare.mockImplementation(async () => {
    m.events.push('prepare');
    return { type: 'ethers-v5', transaction: {} };
  });
  m.ready.mockImplementation(async () => {
    m.events.push('fresh');
  });
  m.send.mockImplementation(async () => {
    m.events.push('send');
    throw Error('TEST_WALLET_STOP_NO_BROADCAST');
  });
});
describe('canonical send-time readiness sequencing', () => {
  it('gets fresh evidence after network/CCS waits and transaction population, immediately before wallet send', async () => {
    await expect(useTransfer().execute(args())).rejects.toThrow('TEST_WALLET_STOP');
    expect(m.events).toEqual(['early', 'network', 'ccs', 'prepare', 'fresh', 'send']);
  });
  it('expired or degraded final readiness prevents wallet submission', async () => {
    m.ready.mockRejectedValueOnce(Error('readiness expired after wallet/CCS wait'));
    await expect(useTransfer().execute(args())).rejects.toThrow('readiness expired');
    expect(m.early).toHaveBeenCalledOnce();
    expect(m.switchNetwork).toHaveBeenCalledOnce();
    expect(m.post).toHaveBeenCalledOnce();
    expect(m.prepare).toHaveBeenCalledOnce();
    expect(m.send).not.toHaveBeenCalled();
  });
  it('failed initial readiness prevents network prompts, population and wallet submission', async () => {
    m.early.mockRejectedValueOnce(Error('initial readiness invalid'));
    await expect(useTransfer().execute(args())).rejects.toThrow('initial readiness');
    expect(m.switchNetwork).not.toHaveBeenCalled();
    expect(m.prepare).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });
});
