import { describe, expect, test } from 'vitest';

import { radixBalanceAddressForToken } from './radix';

describe('radix balance address routing', () => {
  test('maps native zero-address aliases to the Radix native resource denom', () => {
    expect(
      radixBalanceAddressForToken(
        {
          tokenAddress: '0x0000000000000000000000000000000000000000',
          isNative: true,
        },
        'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
      ),
    ).toBe('resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd');
  });

  test('keeps component token addresses on the Hyp adapter path', () => {
    expect(
      radixBalanceAddressForToken({
        tokenAddress: 'component_rdx1cp0fd',
        isNative: false,
      }),
    ).toBe('component_rdx1cp0fd');
  });
});
