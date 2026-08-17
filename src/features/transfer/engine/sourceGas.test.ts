import { ProtocolType } from '@hyperlane-xyz/utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { RouteResponse } from '../../api/types';
import { estimateRouteSourceGasCost, withSourceGasFee } from './sourceGas';
import type { FeeBreakdown } from './types';

const { estimateForUnitsMock, toWalletTxMock } = vi.hoisted(() => ({
  estimateForUnitsMock: vi.fn(),
  toWalletTxMock: vi.fn(),
}));

vi.mock('../../balances/evm', () => ({
  estimateEvmGasCostForUnits: estimateForUnitsMock,
  PENDING_APPROVAL_GAS_BUDGET: 600_000n,
}));

vi.mock('../../../utils/logger', () => ({
  logger: { warn: vi.fn() },
}));

vi.mock('./useTransfer', () => ({
  getRouteTxProviderType: vi.fn(() => 'SolanaWeb3'),
  toWalletTx: toWalletTxMock,
}));

beforeEach(() => {
  estimateForUnitsMock.mockReset().mockResolvedValue(0n);
  toWalletTxMock.mockReset().mockResolvedValue({ type: 'SolanaWeb3', transaction: {} });
});

describe('withSourceGasFee', () => {
  const breakdown: FeeBreakdown = {
    components: [
      {
        category: 'igp',
        chainId: 1,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        amount: 7n,
      },
    ],
    originGas: 200_000n,
    destGas: 0n,
  };

  test('adds source gas as a distinct native fee component', () => {
    expect(withSourceGasFee(breakdown, 1, 3n)?.components).toEqual([
      ...breakdown.components,
      {
        category: 'localGas',
        chainId: 1,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        amount: 3n,
      },
    ]);
  });

  test('replaces an existing source gas estimate instead of double counting it', () => {
    const first = withSourceGasFee(breakdown, 1, 3n);

    expect(withSourceGasFee(first, 1, 5n)?.components.at(-1)?.amount).toBe(5n);
    expect(withSourceGasFee(first, 1, 5n)?.components).toHaveLength(2);
  });
});

describe('estimateRouteSourceGasCost', () => {
  test('uses MultiProtocolProvider fee estimation and sums route transactions', async () => {
    const estimateTransactionFee = vi
      .fn()
      .mockResolvedValueOnce({ gasUnits: 1n, gasPrice: 1n, fee: 3n })
      .mockResolvedValueOnce({ gasUnits: 1n, gasPrice: 1n, fee: 4n });
    const multiProvider = {
      tryGetProtocol: vi.fn(() => ProtocolType.Sealevel),
      tryGetChainMetadata: vi.fn(() => ({ rpcUrls: [{ http: 'https://rpc.test' }] })),
      estimateTransactionFee,
    } as never;
    const senderPubKey = Promise.resolve('abcd');

    await expect(
      estimateRouteSourceGasCost({
        multiProvider,
        chainName: 'solana',
        sender: 'sender',
        senderPubKey,
        route: testRoute(2),
      }),
    ).resolves.toBe(7n);

    expect(estimateTransactionFee).toHaveBeenCalledTimes(2);
    expect(estimateTransactionFee).toHaveBeenCalledWith(
      expect.objectContaining({
        chainNameOrId: 'solana',
        sender: 'sender',
        senderPubKey: 'abcd',
      }),
    );
    expect(estimateForUnitsMock).not.toHaveBeenCalled();
  });

  test('falls back to the engine gas budget when EVM simulation is unsafe', async () => {
    estimateForUnitsMock.mockResolvedValueOnce(9n);
    const estimateTransactionFee = vi.fn().mockRejectedValue(new Error('insufficient funds'));
    const multiProvider = {
      tryGetProtocol: vi.fn(() => ProtocolType.Ethereum),
      tryGetChainMetadata: vi.fn(() => ({ rpcUrls: [{ http: 'https://rpc.test' }] })),
      estimateTransactionFee,
    } as never;

    await expect(
      estimateRouteSourceGasCost({
        multiProvider,
        chainName: 'ethereum',
        sender: '0xsender',
        route: testRoute(),
      }),
    ).resolves.toBe(9n);

    expect(estimateTransactionFee).toHaveBeenCalledOnce();
    expect(estimateForUnitsMock).toHaveBeenCalledWith(multiProvider, {
      chainName: 'ethereum',
      gasUnits: 200_000n,
    });
  });

  test('does not silently treat non-EVM estimation failures as zero fees', async () => {
    const multiProvider = {
      tryGetProtocol: vi.fn(() => ProtocolType.Sealevel),
      tryGetChainMetadata: vi.fn(() => ({ rpcUrls: [{ http: 'https://rpc.test' }] })),
      estimateTransactionFee: vi.fn().mockRejectedValue(new Error('simulation failed')),
    } as never;

    await expect(
      estimateRouteSourceGasCost({
        multiProvider,
        chainName: 'solana',
        sender: 'sender',
        route: testRoute(),
      }),
    ).rejects.toThrow('Unable to estimate source transaction fee');
    expect(estimateForUnitsMock).not.toHaveBeenCalled();
  });

  test('uses the conservative EVM budget while approval is pending', async () => {
    estimateForUnitsMock.mockResolvedValueOnce(9n);
    const estimateTransactionFee = vi.fn();
    const multiProvider = {
      tryGetProtocol: vi.fn(() => ProtocolType.Ethereum),
      estimateTransactionFee,
    } as never;

    await expect(
      estimateRouteSourceGasCost({
        multiProvider,
        chainName: 'ethereum',
        sender: '0xsender',
        route: testRoute(),
        approvalPending: true,
      }),
    ).resolves.toBe(9n);

    expect(estimateTransactionFee).not.toHaveBeenCalled();
    expect(estimateForUnitsMock).toHaveBeenCalledWith(multiProvider, {
      chainName: 'ethereum',
      gasUnits: 600_000n,
    });
  });
});

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
