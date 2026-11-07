import { describe, expect, test } from 'vitest';

import {
  confirmationProgress,
  decodeAuthorizationBody,
  decodeTransferBody,
  estimateConfirmationSeconds,
  estimateDeliverySeconds,
  formatEstimatedTime,
  ProgressState,
} from './progress';

const recipient = `0x${'42'.repeat(32)}`;
describe('message progress evidence', () => {
  test('counts blocks after inclusion, including exact threshold and zero-confirmation policy', () => {
    expect(confirmationProgress(100, 102, 3).state).toBe(ProgressState.Pending);
    expect(confirmationProgress(100, 103, 3).state).toBe(ProgressState.Confirmed);
    expect(confirmationProgress(100, 100, 0).state).toBe(ProgressState.Confirmed);
    expect(confirmationProgress(100, 99, 0).state).toBe(ProgressState.Pending);
  });
  test('decodes warp amounts without losing bigint precision or guessing token decimals', () => {
    const amount = 2n ** 200n + 1n;
    expect(
      decodeTransferBody({
        label: 'bridge',
        body: `${recipient}${amount.toString(16).padStart(64, '0')}`,
      }),
    ).toEqual({ recipient, amount: amount.toString() });
  });
  test('rejects short, non-hex and odd-length bodies', () => {
    for (const body of ['0x01abcd', 'garbage', `0x${'1'.repeat(129)}`]) {
      expect(decodeTransferBody({ label: 'bridge', body })).toBeUndefined();
      expect(decodeAuthorizationBody(body)).toBeUndefined();
    }
  });
  test('decodes matching commit and reveal commitments at their different offsets', () => {
    const owner = '11'.repeat(32),
      ism = '22'.repeat(32),
      salt = '33'.repeat(32),
      commitment = '44'.repeat(32);
    expect(decodeAuthorizationBody(`0x01${owner}${ism}${salt}${commitment}`)).toEqual({
      ism: `0x${ism}`,
      commitment: `0x${commitment}`,
    });
    expect(decodeAuthorizationBody(`0x02${ism}${commitment}`)).toEqual({
      ism: `0x${ism}`,
      commitment: `0x${commitment}`,
    });
  });
});

describe('message timing estimates', () => {
  test('estimates only remaining confirmations, including fractional block times', () => {
    expect(estimateConfirmationSeconds(confirmationProgress(100, 102, 5), 0.25)).toBe(0.75);
    expect(estimateConfirmationSeconds(confirmationProgress(100, 105, 5), 0.25)).toBeUndefined();
    expect(estimateConfirmationSeconds(confirmationProgress(100, 100, 0), 0.25)).toBeUndefined();
    expect(estimateConfirmationSeconds(undefined, 12)).toBeUndefined();
    expect(estimateConfirmationSeconds({ state: ProgressState.Pending }, 12)).toBeUndefined();
    expect(
      estimateConfirmationSeconds(
        { state: ProgressState.Failed, confirmations: 0, required: 5 },
        12,
      ),
    ).toBeUndefined();
    for (const blockTime of [undefined, 0, -1, NaN, Infinity]) {
      expect(
        estimateConfirmationSeconds(confirmationProgress(100, 102, 5), blockTime),
      ).toBeUndefined();
    }
  });

  test('estimates delivery from origin finality plus the relay allowance', () => {
    expect(
      estimateDeliverySeconds({ confirmations: 2, reorgPeriod: 15, estimateBlockTime: 13 }),
    ).toBe(200);
    expect(
      estimateDeliverySeconds({ confirmations: 1, reorgPeriod: 5, estimateBlockTime: 0.25 }),
    ).toBe(6.25);
    expect(
      estimateDeliverySeconds({ confirmations: 1, reorgPeriod: 0, estimateBlockTime: 0.4 }),
    ).toBe(5);
  });

  test('uses remaining origin confirmations and stops estimating failed origins', () => {
    const blocks = { confirmations: 2, reorgPeriod: 15, estimateBlockTime: 2 };
    expect(estimateDeliverySeconds(blocks, confirmationProgress(100, 101, 15))).toBe(33);
    expect(estimateDeliverySeconds(blocks, confirmationProgress(100, 115, 15))).toBe(5);
    expect(estimateDeliverySeconds(blocks, { state: ProgressState.Failed })).toBeUndefined();
  });

  test('omits origin confirmation time once relaying starts, but preserves actual failures', () => {
    const blocks = { confirmations: 2, reorgPeriod: 15, estimateBlockTime: 2 };
    const pending = confirmationProgress(100, 101, 15);
    expect(estimateDeliverySeconds(blocks, pending, false)).toBe(33);
    expect(estimateDeliverySeconds(blocks, pending, true)).toBe(5);
    expect(estimateDeliverySeconds(blocks, undefined, true)).toBe(5);
    expect(estimateDeliverySeconds(blocks, { state: ProgressState.Failed }, true)).toBeUndefined();
  });

  test('uses configured confirmations when the policy is tagged or absent', () => {
    for (const reorgPeriod of ['safe', 'finalized', undefined]) {
      expect(
        estimateDeliverySeconds({ confirmations: 2, reorgPeriod, estimateBlockTime: 0.5 }),
      ).toBe(6);
    }
  });

  test('does not invent estimates for missing or invalid chain timings', () => {
    expect(estimateDeliverySeconds(undefined)).toBeUndefined();
    for (const estimateBlockTime of [undefined, 0, -1, NaN, Infinity]) {
      expect(estimateDeliverySeconds({ confirmations: 2, estimateBlockTime })).toBeUndefined();
    }
    for (const reorgPeriod of [-1, NaN, Infinity]) {
      expect(
        estimateDeliverySeconds({ confirmations: 2, reorgPeriod, estimateBlockTime: 12 }),
      ).toBeUndefined();
    }
  });

  test('rounds minute and hour estimates down without fractional precision', () => {
    expect(formatEstimatedTime(4.1)).toBe('~5s');
    expect(formatEstimatedTime(59.5)).toBe('~60s');
    expect(formatEstimatedTime(61)).toBe('~1 min');
    expect(formatEstimatedTime(119.9)).toBe('~1 min');
    expect(formatEstimatedTime(200)).toBe('~3 min');
    expect(formatEstimatedTime(3599.9)).toBe('~59 min');
    expect(formatEstimatedTime(3601)).toBe('~1 hr');
  });
});
