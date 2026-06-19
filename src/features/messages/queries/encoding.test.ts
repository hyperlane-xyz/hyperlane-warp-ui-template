import type { ChainMetadata } from '@hyperlane-xyz/sdk';
import { bufferToBase58, ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test } from 'vitest';

import { buildMessagesByOriginTxQuery } from './build';
import { txHashToPostgresBytea } from './encoding';

describe('txHashToPostgresBytea', () => {
  test('converts sealevel base58 transaction hashes to bytea hex', () => {
    const bytes = Buffer.from(Array.from({ length: 64 }, (_, i) => i + 1));
    const txHash = bufferToBase58(bytes);
    const metadata = { protocol: ProtocolType.Sealevel } as ChainMetadata;

    expect(txHashToPostgresBytea(txHash, metadata)).toBe(`\\x${bytes.toString('hex')}`);
  });

  test('keeps hex transaction hashes as bytea hex', () => {
    const txHash = `0x${'ab'.repeat(32)}`;
    const metadata = { protocol: ProtocolType.Ethereum } as ChainMetadata;

    expect(txHashToPostgresBytea(txHash, metadata)).toBe(`\\x${'ab'.repeat(32)}`);
  });

  test('does not encode non-hex radix transaction ids as bytea hex', () => {
    const metadata = { protocol: ProtocolType.Radix } as ChainMetadata;

    expect(
      txHashToPostgresBytea(
        'txid_rdx1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
        metadata,
      ),
    ).toBeUndefined();
  });
});

describe('buildMessagesByOriginTxQuery', () => {
  test('returns null when origin tx hash cannot be encoded', () => {
    const metadata = { protocol: ProtocolType.Sealevel } as ChainMetadata;

    expect(buildMessagesByOriginTxQuery('not-a-solana-tx', 1399811149, metadata)).toBeNull();
  });
});
