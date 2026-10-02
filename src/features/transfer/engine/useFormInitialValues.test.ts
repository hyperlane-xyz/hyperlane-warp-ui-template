import { ChainDisabledReason, ChainStatus } from '@hyperlane-xyz/sdk';
import { describe, expect, test, vi } from 'vitest';

import type { UiToken } from '../../tokens/types';
import { getInitialValuesFromTokens } from './useFormInitialValues';

vi.mock(import('../../../consts/config'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    config: { ...actual.config, shouldDisableChains: true },
  };
});

describe('getInitialValuesFromTokens', () => {
  test('does not hydrate disabled-chain origin and destination tokens', () => {
    const values = getInitialValuesFromTokens(
      [
        token({ chainName: 'botanix', chainId: 3637, address: BOTANIX_TOKEN }),
        token({ chainName: 'artela', chainId: 11820, address: ARTELA_TOKEN }),
      ],
      {
        originId: `botanix-${BOTANIX_TOKEN}`,
        destinationId: `artela-${ARTELA_TOKEN}`,
      },
      multiProvider(['botanix', 'artela']),
    );

    expect(values).toMatchObject({
      srcChain: null,
      srcToken: '',
      dstChain: null,
      dstToken: '',
    });
  });
});

const BOTANIX_TOKEN = '0x0000000000000000000000000000000000000001';
const ARTELA_TOKEN = '0x0000000000000000000000000000000000000002';

function token(overrides: Partial<UiToken>): UiToken {
  return {
    chainId: 1,
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'TEST',
    decimals: 18,
    isNative: false,
    isBridgeToken: true,
    isPoolToken: false,
    canBridge: true,
    canSwap: false,
    bridgeSymbols: ['TEST'],
    warpRouteIds: ['TEST/route'],
    chainName: 'ethereum',
    name: 'Test',
    addressOrDenom: '0x0000000000000000000000000000000000000000',
    ...overrides,
  };
}

function multiProvider(disabledChains: string[]) {
  const disabledChainSet = new Set(disabledChains);
  return {
    tryGetChainMetadata: (chainName: string) => {
      if (!disabledChainSet.has(chainName)) return { name: chainName };
      return {
        name: chainName,
        availability: {
          status: ChainStatus.Disabled,
          reasons: [ChainDisabledReason.Unavailable],
        },
      };
    },
  } as never;
}
