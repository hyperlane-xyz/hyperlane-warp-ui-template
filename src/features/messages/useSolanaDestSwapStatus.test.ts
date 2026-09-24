import { describe, expect, test } from 'vitest';

import {
  nextSolanaDestSwapPollState,
  shouldProcessSolanaDestSwapResult,
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

  test('keeps errored reads pending after the fast poll budget', () => {
    let state: SolanaDestSwapPollState = {
      cleanMissingCount: 0,
      pollCount: 0,
      isDone: false,
    };

    for (let i = 0; i < 24; i++) {
      state = nextSolanaDestSwapPollState(state, { exists: false, errored: true });
    }

    expect(state).toEqual({
      cleanMissingCount: 0,
      pollCount: 24,
      isDone: false,
    });
  });
});

describe('shouldProcessSolanaDestSwapResult', () => {
  test('skips cached result already seeded on activation', () => {
    expect(shouldProcessSolanaDestSwapResult(123, 123)).toBe(false);
  });

  test('processes one fresh result after activation', () => {
    const cachedTimestamp = 123;
    const freshTimestamp = 456;

    expect(shouldProcessSolanaDestSwapResult(cachedTimestamp, freshTimestamp)).toBe(true);
    const next = nextSolanaDestSwapPollState(
      { cleanMissingCount: 0, pollCount: 0, isDone: false },
      { exists: false },
    );

    expect(next).toEqual({
      cleanMissingCount: 1,
      pollCount: 1,
      isDone: false,
    });
  });
});
