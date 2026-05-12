import { computeScopedSalt } from '@hyperlane-xyz/sdk';
import { encodePacked, keccak256 } from 'viem';
import { describe, expect, test } from 'vitest';

describe('computeScopedSalt', () => {
  test('matches QuotedCalls._scopeSalt (abi.encodePacked)', () => {
    const sender = '0x1234567890abcdef1234567890abcdef12345678' as const;
    const clientSalt =
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;

    const result = computeScopedSalt(sender, clientSalt);

    const expected = keccak256(encodePacked(['address', 'bytes32'], [sender, clientSalt]));
    expect(result).toBe(expected);
  });

  test('produces 52-byte packed encoding, not 64-byte abi.encode', () => {
    const sender = '0x1234567890abcdef1234567890abcdef12345678' as const;
    const clientSalt =
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const;

    const packed = encodePacked(['address', 'bytes32'], [sender, clientSalt]);
    // address = 20 bytes, bytes32 = 32 bytes => 52 bytes = 104 hex chars + 0x prefix
    expect(packed.length).toBe(2 + 104);
  });

  test('different senders produce different salts', () => {
    const clientSalt =
      '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' as const;
    const salt1 = computeScopedSalt('0x1111111111111111111111111111111111111111', clientSalt);
    const salt2 = computeScopedSalt('0x2222222222222222222222222222222222222222', clientSalt);
    expect(salt1).not.toBe(salt2);
  });
});
