import { TokenStandard } from '@hyperlane-xyz/sdk/token/TokenStandard';
import { normalizeAddress } from '@hyperlane-xyz/utils';
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
    const cosmosToken = createMockToken({
      chainName: 'cosmoshub',
      standard: TokenStandard.CosmosIbc,
      addressOrDenom: 'ibc/27394FB092D2A2A821B4B8C3670D8E4C0A9D1C6A1BDAA1F4B1C7E7DA4D5E6F70',
      decimals: 6,
    });

    const result = getRouterAddressesByChain([evmToken, sealevelToken, cosmosToken]);
    const normalizedEvmAddress = normalizeAddress(VALID_EVM_ADDRESS);

    expect(result.ethereum?.has(normalizedEvmAddress)).toBe(true);
    expect(result.ethereum?.has('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')).toBe(false);
    expect(result.solanamainnet?.has(sealevelToken.addressOrDenom)).toBe(true);
    expect(result.cosmoshub?.has(cosmosToken.addressOrDenom)).toBe(true);
  });
});
