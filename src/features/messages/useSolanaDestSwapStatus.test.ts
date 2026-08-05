import { describe, expect, test } from 'vitest';

import {
  nextSolanaDestSwapPollState,
  type SolanaDestSwapPollState,
} from './useSolanaDestSwapStatus';

describe('nextSolanaDestSwapPollState', () => {
  test('counts identical clean missing responses as separate polls', () => {
    const initial: SolanaDestSwapPollState = {
      cleanMissingCount: 0,
      pollCount: 0,
      isDone: false,
    };

    const first = nextSolanaDestSwapPollState(initial, { exists: false });
    const second = nextSolanaDestSwapPollState(first, { exists: false });

    expect(second).toEqual({
      cleanMissingCount: 2,
      pollCount: 2,
      isDone: true,
    });
  });

  test('does not count errored reads toward clean missing confirmations', () => {
    const next = nextSolanaDestSwapPollState(
      { cleanMissingCount: 1, pollCount: 1, isDone: false },
      { exists: false, errored: true },
    );

    expect(next).toEqual({
      cleanMissingCount: 1,
      pollCount: 2,
      isDone: false,
    });
  });
});
