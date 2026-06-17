import { describe, expect, test } from 'vitest';

import { tokenKey } from './utils';

describe('tokenKey', () => {
  test('lowercases EVM addresses', () => {
    expect(tokenKey(1, '0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48')).toBe(
      '1-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    );
  });

  test('preserves non-EVM token casing', () => {
    expect(tokenKey(101, 'So11111111111111111111111111111111111111112')).toBe(
      '101-So11111111111111111111111111111111111111112',
    );
  });
});
