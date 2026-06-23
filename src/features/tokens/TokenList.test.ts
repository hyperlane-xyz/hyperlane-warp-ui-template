import { describe, expect, test } from 'vitest';

import type { ChainDiscovery } from '../api/types';
import { getEngineChainIdForName } from './TokenList';

describe('getEngineChainIdForName', () => {
  test('uses engine chain id for Aleo instead of registry chainId 0', () => {
    const chains = [
      {
        id: 1634493807,
        name: 'Aleo',
        chainName: 'aleo',
        displayName: 'Aleo',
        protocol: 'aleo',
        nativeCurrency: {
          name: 'Aleo',
          symbol: 'ALEO',
          decimals: 6,
        },
        universalRouter: '0x0000000000000000000000000000000000000000',
        permit2: '0x0000000000000000000000000000000000000000',
        dex: null,
        canSwap: false,
        canExecute: false,
        supportsNative: false,
        gasCurrencyCoinGeckoId: 'aleo',
      },
    ] satisfies ChainDiscovery[];

    expect(getEngineChainIdForName(chains, 'aleo')).toBe(1634493807);
  });
});
