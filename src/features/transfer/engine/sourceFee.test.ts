import { ProtocolType } from '@hyperlane-xyz/utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { RouteResponse } from '../../api/types';
import { appendSourceFee, estimateRouteSourceFee, estimateStarknetSourceFee } from './sourceFee';

const { prepareApprovalTransactionMock, prepareRouteTransactionMock } = vi.hoisted(() => ({
  prepareApprovalTransactionMock: vi.fn(),
  prepareRouteTransactionMock: vi.fn(),
}));

vi.mock('./routeTransactions', () => ({
  prepareApprovalTransaction: prepareApprovalTransactionMock,
  prepareRouteTransaction: prepareRouteTransactionMock,
}));

vi.mock('../../../utils/logger', () => ({ logger: { warn: vi.fn() } }));

beforeEach(() => {
  prepareApprovalTransactionMock.mockReset().mockResolvedValue({
    type: 'test',
    transaction: {},
  });
  prepareRouteTransactionMock.mockReset().mockResolvedValue({ type: 'test', transaction: {} });
});

describe('estimateRouteSourceFee', () => {
  test.each([
    ProtocolType.Sealevel,
    ProtocolType.Cosmos,
    ProtocolType.CosmosNative,
    ProtocolType.Radix,
    ProtocolType.Aleo,
    ProtocolType.Tron,
  ])('routes %s fee estimation through MultiProtocolProvider', async (protocol) => {
    const estimateTransactionFee = vi.fn().mockResolvedValue({ fee: 5n });

    await expect(
      estimateRouteSourceFee({
        multiProvider: provider(protocol, estimateTransactionFee),
        chainName: 'source',
        sender: 'sender',
        route: testRoute(),
        approvalAmounts: [],
      }),
    ).resolves.toBe(5n);
    expect(estimateTransactionFee).toHaveBeenCalledOnce();
  });

  test('uses MultiProtocolProvider and sums every prepared transaction', async () => {
    const estimateTransactionFee = vi
      .fn()
      .mockResolvedValueOnce({ fee: 3n })
      .mockResolvedValueOnce({ fee: 4n });
    const multiProvider = provider(ProtocolType.Sealevel, estimateTransactionFee);

    await expect(
      estimateRouteSourceFee({
        multiProvider,
        chainName: 'solana',
        sender: 'sender',
        senderPubKey: Promise.resolve('abcd'),
        route: testRoute(2),
        approvalAmounts: [],
      }),
    ).resolves.toBe(7n);

    expect(estimateTransactionFee).toHaveBeenCalledTimes(2);
    expect(estimateTransactionFee).toHaveBeenCalledWith(
      expect.objectContaining({ chainNameOrId: 'solana', senderPubKey: 'abcd' }),
    );
  });

  test('fails instead of applying an EVM fallback to another VM', async () => {
    const multiProvider = provider(
      ProtocolType.Sealevel,
      vi.fn().mockRejectedValue(new Error('simulation failed')),
    );

    await expect(
      estimateRouteSourceFee({
        multiProvider,
        chainName: 'solana',
        sender: 'sender',
        route: testRoute(),
        approvalAmounts: [],
      }),
    ).rejects.toThrow('Unable to estimate source fee on solana');
  });

  test('rejects a zero Solana fee instead of treating the route as fee-free', async () => {
    const multiProvider = provider(ProtocolType.Sealevel, vi.fn().mockResolvedValue({ fee: 0n }));

    await expect(
      estimateRouteSourceFee({
        multiProvider,
        chainName: 'solana',
        sender: 'sender',
        route: testRoute(),
        approvalAmounts: [],
      }),
    ).rejects.toThrow('Unable to estimate source fee on solana');
  });

  test('buffers engine gas units and uses the complete EIP-1559 fee', async () => {
    const multiProvider = provider(
      ProtocolType.Ethereum,
      vi.fn().mockRejectedValue(new Error('insufficient funds')),
    );

    await expect(
      estimateRouteSourceFee({
        multiProvider,
        chainName: 'ethereum',
        sender: '0xsender',
        route: testRoute(),
        approvalAmounts: [],
      }),
    ).resolves.toBe(660_000n);
  });

  test('uses the legacy gas price when EIP-1559 fee data is unavailable', async () => {
    const multiProvider = provider(
      ProtocolType.Ethereum,
      vi.fn().mockRejectedValue(new Error('insufficient funds')),
      { gasPrice: 3n },
    );

    await expect(
      estimateRouteSourceFee({
        multiProvider,
        chainName: 'ethereum',
        sender: '0xsender',
        route: testRoute(),
        approvalAmounts: [],
      }),
    ).resolves.toBe(660_000n);
  });

  test('uses the EVM gas budget fallback when the provider returns zero', async () => {
    const multiProvider = provider(ProtocolType.Ethereum, vi.fn().mockResolvedValue({ fee: 0n }));

    await expect(
      estimateRouteSourceFee({
        multiProvider,
        chainName: 'ethereum',
        sender: '0xsender',
        route: testRoute(),
        approvalAmounts: [],
      }),
    ).resolves.toBe(660_000n);
  });

  test.each([ProtocolType.Ethereum, ProtocolType.Tron])(
    'includes %s approval transactions in the shared estimate',
    async (protocol) => {
      const estimateTransactionFee = vi.fn().mockResolvedValue({ fee: 3n });
      const route = testRoute();
      route.approval = {
        token: '0x1111111111111111111111111111111111111111',
        spender: '0x2222222222222222222222222222222222222222',
        amount: '1',
        kind: 'erc20',
      };

      await expect(
        estimateRouteSourceFee({
          multiProvider: provider(protocol, estimateTransactionFee),
          chainName: 'source',
          sender: 'sender',
          route,
          approvalAmounts: [1n],
        }),
      ).resolves.toBe(6n);
      expect(prepareApprovalTransactionMock).toHaveBeenCalledOnce();
      expect(estimateTransactionFee).toHaveBeenCalledTimes(2);
    },
  );

  test.each([ProtocolType.Ethereum, ProtocolType.Tron])(
    'uses the EVM-like gas budget when a %s route cannot simulate before approval',
    async (protocol) => {
      const estimateTransactionFee = vi
        .fn()
        .mockResolvedValueOnce({ fee: 3n })
        .mockRejectedValueOnce(new Error('approval required'));
      const route = testRoute();
      route.approval = {
        token: '0x1111111111111111111111111111111111111111',
        spender: '0x2222222222222222222222222222222222222222',
        amount: '1',
        kind: 'erc20',
      };

      await expect(
        estimateRouteSourceFee({
          multiProvider: provider(protocol, estimateTransactionFee),
          chainName: 'source',
          sender: 'sender',
          route,
          approvalAmounts: [1n],
        }),
      ).resolves.toBe(1_980_000n);
      expect(estimateTransactionFee).toHaveBeenCalledTimes(2);
    },
  );
});

test('estimates Starknet fees through the connected account', async () => {
  const route = testRoute();
  route.tx = {
    protocol: ProtocolType.Starknet,
    type: 'Starknet',
    category: 'transfer',
    transaction: { contractAddress: '0x1', entrypoint: 'transfer', calldata: [] },
  };
  route.txs = [];
  const estimateInvokeFee = vi.fn().mockResolvedValue({ suggestedMaxFee: 7n });

  await expect(estimateStarknetSourceFee(route, { estimateInvokeFee } as never)).resolves.toBe(7n);
  expect(estimateInvokeFee).toHaveBeenCalledOnce();
});

test('appendSourceFee adds one source-native fee component', () => {
  expect(
    appendSourceFee({ components: [], originGas: 1n, destGas: 0n }, 1, 3n)?.components,
  ).toEqual([
    {
      category: 'source',
      chainId: 1,
      tokenAddress: '0x0000000000000000000000000000000000000000',
      amount: 3n,
    },
  ]);
});

function provider(
  protocol: ProtocolType,
  estimateTransactionFee: ReturnType<typeof vi.fn>,
  feeData: Partial<Record<'gasPrice' | 'maxFeePerGas' | 'maxPriorityFeePerGas', bigint>> = {
    maxFeePerGas: 2n,
    maxPriorityFeePerGas: 1n,
  },
) {
  return {
    tryGetProtocol: vi.fn(() => protocol),
    tryGetChainMetadata: vi.fn(() => ({ rpcUrls: [{ http: 'https://rpc.test' }] })),
    estimateTransactionFee,
    getEthersV5Provider: vi.fn(() => ({
      getFeeData: vi.fn().mockResolvedValue(feeData),
    })),
  } as never;
}

function testRoute(txCount = 1): RouteResponse {
  const tx = { to: 'program', data: '', value: '0' };
  return {
    steps: [
      {
        type: 'swap',
        chain: 1,
        dex: 'test',
        tokenIn: 'token-in',
        tokenOut: 'token-out',
        amountIn: '1000',
        amountOut: '900',
        path: ['token-in', 'token-out'],
        poolCount: 1,
      },
    ],
    output: '900',
    outputMin: '900',
    executionKind: 'universalRouter',
    connection: null,
    gas: { originGas: '200000', destGas: '0' },
    tx,
    txs: Array.from({ length: txCount }, () => tx),
    approval: null,
  };
}
