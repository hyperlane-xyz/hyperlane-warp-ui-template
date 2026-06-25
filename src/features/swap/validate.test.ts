import { ProtocolType } from '@hyperlane-xyz/utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { ChainDiscovery } from '../api/types';
import { estimateNativeGasCost, readBalance } from './balances/read';
import type { UiToken } from './tokens/types';
import type { AugmentedRoute } from './types';
import { validateBalances } from './validate';

vi.mock('./balances/read', () => ({
  estimateNativeGasCost: vi.fn(),
  readBalance: vi.fn(),
}));

const srcChainInfo: ChainDiscovery = {
  id: 1,
  name: 'Ethereum',
  chainName: 'ethereum',
  protocol: ProtocolType.Ethereum,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  universalRouter: '0x1111111111111111111111111111111111111111',
  dex: 'test-dex',
  canSwap: true,
  canExecute: true,
  supportsNative: true,
};

const srcToken: UiToken = {
  chainId: 1,
  chainName: 'ethereum',
  address: '0x2222222222222222222222222222222222222222',
  addressOrDenom: '0x2222222222222222222222222222222222222222',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  isNative: false,
  isBridgeToken: false,
  isPoolToken: false,
  canBridge: false,
  canSwap: true,
  bridgeSymbols: [],
  warpRouteIds: [],
};

function routeWithNativeIgp(): AugmentedRoute {
  return {
    isBridgeOnly: false,
    feeBreakdown: {
      components: [
        {
          category: 'igp',
          amount: 20n,
          chainId: 1,
          tokenAddress: '0x0000000000000000000000000000000000000000',
        },
      ],
      originGas: 0n,
      destGas: 0n,
    },
    raw: {
      steps: [
        {
          type: 'swap',
          chain: 1,
          dex: 'test',
          tokenIn: srcToken.address,
          tokenOut: '0x3333333333333333333333333333333333333333',
          amountIn: '100',
          amountOut: '95',
          path: [srcToken.address, '0x3333333333333333333333333333333333333333'],
          poolCount: 1,
          minPoolTvlUsd: null,
        },
      ],
      output: '95',
      outputMin: '90',
      connection: null,
      gas: { originGas: '0', destGas: '0' },
      tx: {
        to: srcChainInfo.universalRouter,
        data: '0x1234',
        value: '0',
      },
    },
  };
}

describe('validateBalances', () => {
  beforeEach(() => {
    vi.mocked(readBalance).mockReset();
    vi.mocked(estimateNativeGasCost).mockReset();
  });

  test('requires native balance for native IGP and gas on ERC20 routes', async () => {
    vi.mocked(readBalance).mockImplementation(async (_multiProvider, args) =>
      args.isNative ? 22n : 1_000n,
    );
    vi.mocked(estimateNativeGasCost).mockResolvedValue(5n);

    await expect(
      validateBalances({
        multiProvider: {} as any,
        srcChainInfo,
        srcToken,
        sender: '0x4444444444444444444444444444444444444444',
        bestRoute: routeWithNativeIgp(),
        amountAtomic: 100n,
      }),
    ).resolves.toEqual({ amount: 'Insufficient ETH for transaction value and gas' });
  });
});
