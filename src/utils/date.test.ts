import { describe, expect, test } from 'vitest';
import { formatTimestamp, formatTransferHistoryTimestamp } from './date';

describe('formatTransferHistoryTimestamp', () => {
  const now = 1_700_000_000_000;

  test('formats future timestamps as absolute time', () => {
    const timestamp = now + 5_000;
    expect(formatTransferHistoryTimestamp(timestamp, now)).toBe(formatTimestamp(timestamp));
  });

  test('uses seconds for values under a minute', () => {
    const timestamp = now - 59_000;
    expect(formatTransferHistoryTimestamp(timestamp, now)).toBe('59s ago');
  });

  test('rolls over to minutes at 60 seconds', () => {
    const timestamp = now - 60_000;
    expect(formatTransferHistoryTimestamp(timestamp, now)).toBe('1m ago');
  });

  test('uses minutes for values under an hour', () => {
    const timestamp = now - (59 * 60 + 59) * 1000;
    expect(formatTransferHistoryTimestamp(timestamp, now)).toBe('59m ago');
  });

  test('rolls over to hours at 60 minutes', () => {
    const timestamp = now - 60 * 60 * 1000;
    expect(formatTransferHistoryTimestamp(timestamp, now)).toBe('1h ago');
  });

  test('uses hours for values under 24 hours', () => {
    const timestamp = now - (23 * 60 * 60 + 59 * 60) * 1000;
    expect(formatTransferHistoryTimestamp(timestamp, now)).toBe('23h ago');
  });

  test('falls back to absolute time at 24 hours', () => {
    const timestamp = now - 24 * 60 * 60 * 1000;
    expect(formatTransferHistoryTimestamp(timestamp, now)).toBe(formatTimestamp(timestamp));
  });
});
