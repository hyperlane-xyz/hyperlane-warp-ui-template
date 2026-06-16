import { describe, expect, test } from 'vitest';

import { config } from '../../../consts/config';
import { getVisibleUnifiedTokens } from './list';
import type { UnifiedToken } from './types';

function createUnifiedToken(args: Partial<UnifiedToken> = {}): UnifiedToken {
  return {
    key: `${args.chainName ?? 'ethereum'}-${args.symbol ?? 'TEST'}`,
    chainName: 'ethereum',
    chainId: 1,
    addressOrDenom: '0x0000000000000000000000000000000000000001',
    symbol: 'TEST',
    name: 'Test Token',
    decimals: 18,
    isNative: false,
    capabilities: {
      bridge: false,
      swap: false,
    },
    ...args,
  };
}

describe('getVisibleUnifiedTokens', () => {
  test('puts featured tokens at the beginning of the default list', () => {
    const firstFeatured = config.featuredTokens[0];
    const [chainName, symbol] = firstFeatured.split('-');
    const regular = createUnifiedToken({
      key: 'z-regular',
      chainName: 'zzz',
      symbol: 'AAA',
      capabilities: { bridge: true, swap: false },
    });
    const featured = createUnifiedToken({
      key: firstFeatured,
      chainName,
      symbol,
      capabilities: { bridge: false, swap: false },
    });

    const result = getVisibleUnifiedTokens({
      allTokens: [regular, featured],
      counterpartToken: undefined,
      selectionMode: 'origin',
      collateralGroups: new Map(),
      engineEnabled: true,
      hasFilter: false,
    });

    expect(result.tokens.map((token) => token.key)).toEqual([firstFeatured, 'z-regular']);
  });

  test('does not hide non-featured tokens when searching', () => {
    const hiddenWithoutFilter = createUnifiedToken({
      key: 'non-featured-unrouted',
      chainName: 'zzz',
      symbol: 'ZZZ',
      capabilities: { bridge: false, swap: false },
    });

    const result = getVisibleUnifiedTokens({
      allTokens: [hiddenWithoutFilter],
      counterpartToken: undefined,
      selectionMode: 'origin',
      collateralGroups: new Map(),
      engineEnabled: true,
      hasFilter: true,
    });

    expect(result.tokens).toEqual([hiddenWithoutFilter]);
  });
});
