import { ProviderType } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { RouteResponse } from '../../api/types';
import { estimateRouteSourceFee } from './sourceFee';

const { prepareRouteTransactionMock } = vi.hoisted(() => ({
  prepareRouteTransactionMock: vi.fn(),
}));

vi.mock('./routeTransactions', () => ({
  prepareRouteTransaction: prepareRouteTransactionMock,
}));

beforeEach(() => {
  prepareRouteTransactionMock.mockReset();
});

describe('estimateRouteSourceFee', () => {
  test('uses the SDK estimator with the prepared route transaction and sender public key', async () => {
    const transaction = typedTransaction(ProviderType.SolanaWeb3);
    prepareRouteTransactionMock.mockResolvedValue(transaction);
    const estimateTransactionFee = vi
      .fn()
      .mockResolvedValue({ gasUnits: 1n, gasPrice: 2n, fee: 7n });
    const multiProvider = provider(ProtocolType.Sealevel, estimateTransactionFee);
    const senderPubKey = Promise.resolve('abcd');

    await expect(
      estimateRouteSourceFee({
        multiProvider,
        chainName: 'solanamainnet',
        sender: 'sender',
        senderPubKey,
        route: route(),
        approvalPending: false,
      }),
    ).resolves.toBe(7n);

    expect(prepareRouteTransactionMock).toHaveBeenCalledWith(expect.anything(), {
      protocol: ProtocolType.Sealevel,
      sender: 'sender',
      rpcUrl: 'https://rpc.test',
    });
    expect(estimateTransactionFee).toHaveBeenCalledWith({
      chainNameOrId: 'solanamainnet',
      transaction,
      sender: 'sender',
      senderPubKey: 'abcd',
    });
  });

  test('uses the existing combined budget while an EVM-like approval is pending', async () => {
    const estimateTransactionFee = vi.fn();
    const multiProvider = provider(ProtocolType.Ethereum, estimateTransactionFee, {
      maxFeePerGas: 2n,
      maxPriorityFeePerGas: 1n,
      gasPrice: 1n,
    });

    await expect(
      estimateRouteSourceFee({
        multiProvider,
        chainName: 'ethereum',
        sender: '0xsender',
        route: route({
          token: '0xtoken',
          spender: '0xspender',
          amount: '10',
          kind: 'erc20',
        }),
        approvalPending: true,
      }),
    ).resolves.toBe(1_800_000n);

    expect(prepareRouteTransactionMock).not.toHaveBeenCalled();
    expect(estimateTransactionFee).not.toHaveBeenCalled();
  });

  test('uses the existing combined budget for multiple EVM-like transactions', async () => {
    const estimateTransactionFee = vi.fn();
    const multiProvider = provider(ProtocolType.Ethereum, estimateTransactionFee, {
      gasPrice: 2n,
    });
    const sdkRoute = route();
    sdkRoute.txs = [sdkRoute.tx!, sdkRoute.tx!];

    await expect(
      estimateRouteSourceFee({
        multiProvider,
        chainName: 'ethereum',
        sender: '0xsender',
        route: sdkRoute,
        approvalPending: false,
      }),
    ).resolves.toBe(1_200_000n);

    expect(prepareRouteTransactionMock).not.toHaveBeenCalled();
    expect(estimateTransactionFee).not.toHaveBeenCalled();
  });

  test('sums all SDK-provided non-EVM route transactions', async () => {
    prepareRouteTransactionMock
      .mockResolvedValueOnce(typedTransaction(ProviderType.SolanaWeb3))
      .mockResolvedValueOnce(typedTransaction(ProviderType.SolanaWeb3));
    const estimateTransactionFee = vi
      .fn()
      .mockResolvedValueOnce({ gasUnits: 1n, gasPrice: 1n, fee: 2n })
      .mockResolvedValueOnce({ gasUnits: 1n, gasPrice: 1n, fee: 3n });
    const sdkRoute = route();
    sdkRoute.txs = [sdkRoute.tx!, sdkRoute.tx!];

    await expect(
      estimateRouteSourceFee({
        multiProvider: provider(ProtocolType.Sealevel, estimateTransactionFee),
        chainName: 'solanamainnet',
        sender: 'sender',
        route: sdkRoute,
        approvalPending: false,
      }),
    ).resolves.toBe(5n);

    expect(prepareRouteTransactionMock).toHaveBeenCalledTimes(2);
    expect(estimateTransactionFee).toHaveBeenCalledTimes(2);
  });

  test('does not hide SDK estimation failures', async () => {
    prepareRouteTransactionMock.mockResolvedValue(typedTransaction(ProviderType.EthersV5));
    const estimateTransactionFee = vi.fn().mockRejectedValue(new Error('insufficient funds'));

    await expect(
      estimateRouteSourceFee({
        multiProvider: provider(ProtocolType.Ethereum, estimateTransactionFee),
        chainName: 'ethereum',
        sender: '0xsender',
        route: route(),
        approvalPending: false,
      }),
    ).rejects.toThrow('insufficient funds');
  });
});

function provider(
  protocol: ProtocolType,
  estimateTransactionFee: ReturnType<typeof vi.fn>,
  feeData = {},
) {
  return {
    tryGetProtocol: () => protocol,
    tryGetChainMetadata: () => ({ rpcUrls: [{ http: 'https://rpc.test' }] }),
    estimateTransactionFee,
    getEthersV5Provider: () => ({ getFeeData: vi.fn().mockResolvedValue(feeData) }),
  } as never;
}

function typedTransaction(type: ProviderType) {
  return { type, transaction: {}, category: 'transfer' };
}

function route(approval: RouteResponse['approval'] = null): RouteResponse {
  return {
    steps: [],
    output: '1',
    outputMin: '1',
    executionKind: 'universalRouter',
    connection: null,
    gas: { originGas: '1', destGas: '0' },
    tx: { to: '0x1', data: '0x', value: '0' },
    txs: [],
    approval,
  } as RouteResponse;
}
