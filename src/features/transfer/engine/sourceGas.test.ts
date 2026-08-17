import { describe, expect, test } from 'vitest';

import { withSourceGasFee } from './sourceGas';
import type { FeeBreakdown } from './types';

describe('withSourceGasFee', () => {
  const breakdown: FeeBreakdown = {
    components: [
      {
        category: 'igp',
        chainId: 1,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        amount: 7n,
      },
    ],
    originGas: 200_000n,
    destGas: 0n,
  };

  test('adds source gas as a distinct native fee component', () => {
    expect(withSourceGasFee(breakdown, 1, 3n)?.components).toEqual([
      ...breakdown.components,
      {
        category: 'localGas',
        chainId: 1,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        amount: 3n,
      },
    ]);
  });

  test('replaces an existing source gas estimate instead of double counting it', () => {
    const first = withSourceGasFee(breakdown, 1, 3n);

    expect(withSourceGasFee(first, 1, 5n)?.components.at(-1)?.amount).toBe(5n);
    expect(withSourceGasFee(first, 1, 5n)?.components).toHaveLength(2);
  });
});
