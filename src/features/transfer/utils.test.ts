import { describe, expect, test, vi } from 'vitest';
import { estimateDeliverySeconds, formatEta } from './utils';

describe('formatEta', () => {
  test('returns seconds for values under 60', () => {
    expect(formatEta(30)).toBe('~30s');
    expect(formatEta(1)).toBe('~1s');
    expect(formatEta(59)).toBe('~59s');
  });

  test('returns minutes at 60s boundary', () => {
    expect(formatEta(60)).toBe('~1 min');
  });

  test('rounds up to nearest minute', () => {
    expect(formatEta(61)).toBe('~2 min');
    expect(formatEta(120)).toBe('~2 min');
    expect(formatEta(150)).toBe('~3 min');
  });
});

describe('estimateDeliverySeconds', () => {
  const mockMultiProvider = {
    tryGetChainMetadata: vi.fn(),
  } as any;

  test('returns null when origin metadata is missing', () => {
    mockMultiProvider.tryGetChainMetadata.mockReturnValue(null);
    expect(estimateDeliverySeconds('origin', 'dest', mockMultiProvider)).toBeNull();
  });

  test('returns null when destination metadata is missing', () => {
    mockMultiProvider.tryGetChainMetadata
      .mockReturnValueOnce({ blocks: {} })
      .mockReturnValueOnce(null);
    expect(estimateDeliverySeconds('origin', 'dest', mockMultiProvider)).toBeNull();
  });

  test('uses defaults when block metadata is sparse', () => {
    mockMultiProvider.tryGetChainMetadata.mockReturnValue({ blocks: {} });
    const result = estimateDeliverySeconds('origin', 'dest', mockMultiProvider);
    // defaults: blockTime=3, confirmations=3, reorgBlocks=0
    // finalityTime = (3 + 0) * 3 = 9, validation = 5, relay = 3 * 1.5 = 4.5
    // total = ceil(9 + 5 + 4.5) = 19
    expect(result).toBe(19);
  });

  test('uses numeric reorgPeriod', () => {
    mockMultiProvider.tryGetChainMetadata.mockReturnValue({
      blocks: { estimateBlockTime: 2, confirmations: 5, reorgPeriod: 10 },
    });
    // finalityTime = (5 + 10) * 2 = 30, validation = 5, relay = 2 * 1.5 = 3
    // total = ceil(30 + 5 + 3) = 38
    expect(estimateDeliverySeconds('origin', 'dest', mockMultiProvider)).toBe(38);
  });

  test('ignores string reorgPeriod like "finalized"', () => {
    mockMultiProvider.tryGetChainMetadata.mockReturnValue({
      blocks: { estimateBlockTime: 2, confirmations: 5, reorgPeriod: 'finalized' },
    });
    // reorgBlocks = 0 (string ignored), finalityTime = (5 + 0) * 2 = 10
    // validation = 5, relay = 2 * 1.5 = 3, total = ceil(10 + 5 + 3) = 18
    expect(estimateDeliverySeconds('origin', 'dest', mockMultiProvider)).toBe(18);
  });
});
