import { TokenStandard } from '@hyperlane-xyz/sdk/token/TokenStandard';
import { describe, expect, test } from 'vitest';

import { createMockToken } from '../utils/test';
import { getRouterAddressesByChain } from './store';

const VALID_EVM_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

describe('getRouterAddressesByChain', () => {
  test('normalizes EVM addresses but preserves case-sensitive non-EVM addresses', () => {
    const evmToken = createMockToken({
      chainName: 'ethereum',
      standard: TokenStandard.EvmHypCollateral,
      addressOrDenom: VALID_EVM_ADDRESS,
      decimals: 6,
    });
    const sealevelToken = createMockToken({
      chainName: 'solanamainnet',
      standard: TokenStandard.SealevelHypCollateral,
      addressOrDenom: 'So11111111111111111111111111111111111111112',
      decimals: 9,
    });

    const result = getRouterAddressesByChain([evmToken, sealevelToken], {
      ethereum: {
        [VALID_EVM_ADDRESS]: 18,
      },
      solanamainnet: {
        [sealevelToken.addressOrDenom]: 9,
      },
    });

    expect(result.ethereum?.[VALID_EVM_ADDRESS]).toEqual({
      wireDecimals: 18,
    });
    expect(result.ethereum?.['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48']).toBeUndefined();
    expect(result.solanamainnet?.[sealevelToken.addressOrDenom]).toEqual({
      wireDecimals: 9,
    });
  });
});
