import { ChainDisabledReason, ChainStatus } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test, vi } from 'vitest';

import type { ChainDiscovery } from '../api/types';
import { toTransferChainInfo } from './hooks';

vi.mock('../../consts/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../consts/config')>();
  return {
    ...actual,
    config: { ...actual.config, shouldDisableChains: true },
  };
});

describe('toTransferChainInfo', () => {
  test('preserves disabled-chain metadata for engine-returned chains', () => {
    const chainInfo = toTransferChainInfo(engineChain(), {
      tryGetChainMetadata: (chainName: string) =>
        chainName === 'botanix'
          ? {
              name: chainName,
              displayName: 'Botanix',
              protocol: ProtocolType.Ethereum,
              availability: {
                status: ChainStatus.Disabled,
                reasons: [ChainDisabledReason.Unavailable],
              },
            }
          : undefined,
    } as never);

    expect(chainInfo).toMatchObject({
      name: 'botanix',
      displayName: 'Botanix',
      disabled: true,
    });
  });
});

function engineChain(): ChainDiscovery {
  return {
    id: 3637,
    name: 'Botanix',
    chainName: 'botanix',
    protocol: ProtocolType.Ethereum,
    nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
    universalRouter: '0x0000000000000000000000000000000000000001',
    dex: null,
    canSwap: false,
    canExecute: true,
    supportsNative: true,
  };
}
