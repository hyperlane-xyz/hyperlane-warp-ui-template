import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { TokenStandard } from '@hyperlane-xyz/sdk';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { directAleoBalanceDenom, readAleoTokenBalance } from './aleo';

const getBalanceMock = vi.fn();

describe('aleo balance routing', () => {
  beforeEach(() => {
    getBalanceMock.mockReset();
    getBalanceMock.mockResolvedValue(987654n);
  });

  test('reads native zero-address tokens through the chain native denom', async () => {
    const balance = await readAleoTokenBalance(multiProviderWithNativeDenom('credits'), {
      chainName: 'aleo',
      tokenAddress: '0x0000000000000000000000000000000000000000',
      isNative: true,
      owner: 'aleo1owner',
      standard: TokenStandard.AleoHypNative,
    });

    expect(balance).toBe(987654n);
    expect(getBalanceMock).toHaveBeenCalledWith({
      address: 'aleo1owner',
      denom: 'credits',
    });
  });

  test('does not remap non-native zero-address token ids', () => {
    expect(
      directAleoBalanceDenom({
        tokenAddress: '0x0000000000000000000000000000000000000000',
        isNative: false,
        standard: TokenStandard.AleoHypSynthetic,
      }),
    ).toBeNull();
  });
});

function multiProviderWithNativeDenom(denom: string): MultiProtocolProvider {
  return {
    tryGetChainMetadata: () => ({
      nativeToken: { denom },
    }),
    getProvider: () => ({
      provider: {
        getBalance: getBalanceMock,
      },
    }),
  } as unknown as MultiProtocolProvider;
}
