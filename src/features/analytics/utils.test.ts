import { describe, expect, test } from 'vitest';

import { getAnalyticsChains, getAnalyticsToken } from './utils';

describe('analytics event helpers', () => {
  test('packs chains in dbt-compatible order', () => {
    expect(
      getAnalyticsChains(
        { chainName: 'arbitrum', chainId: 42161 },
        { chainName: 'base', chainId: 8453 },
      ),
    ).toBe('arbitrum|42161|base|8453');
  });

  test('packs one token address and symbol per field', () => {
    expect(getAnalyticsToken({ address: '0xSource', symbol: 'CHIP' })).toBe('0xSource|CHIP');
  });
});
