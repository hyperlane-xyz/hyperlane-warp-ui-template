import { describe, expect, test } from 'vitest';

import {
  confirmationProgress,
  decodeAuthorizationBody,
  decodeTransferBody,
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
      owner: `0x${owner}`,
      ism: `0x${ism}`,
      salt: `0x${salt}`,
      commitment: `0x${commitment}`,
    });
    expect(decodeAuthorizationBody(`0x02${ism}${commitment}`)).toEqual({
      ism: `0x${ism}`,
      commitment: `0x${commitment}`,
    });
  });
});
