import type { ChainMetadata } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test } from 'vitest';

import { postgresByteaToAddress, postgresByteaToTxHash } from './encoding';

describe('postgresByteaToTxHash', () => {
  test('formats protocol-specific transaction hashes for explorer links', () => {
    const bytea = `\\x${byteRangeHex()}`;

    expect(postgresByteaToTxHash(bytea, { protocol: ProtocolType.Cosmos } as ChainMetadata)).toBe(
      byteRangeHex(),
    );
    expect(postgresByteaToTxHash(bytea, { protocol: ProtocolType.Tron } as ChainMetadata)).toBe(
      byteRangeHex(),
    );
    expect(
      postgresByteaToTxHash(bytea, {
        protocol: ProtocolType.Radix,
        bech32Prefix: 'account_rdx',
      } as ChainMetadata),
    ).toBe('txid_rdx1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5z5tpwxqergd3c8g7rusq30nj38');
    expect(postgresByteaToTxHash(bytea, { protocol: ProtocolType.Aleo } as ChainMetadata)).toBe(
      'at1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5z5tpwxqergd3c8g7rusqhemxyq',
    );
  });
});

describe('postgresByteaToAddress', () => {
  test('returns zero-byte addresses as hex instead of throwing', () => {
    expect(
      postgresByteaToAddress(`\\x${'00'.repeat(32)}`, {
        protocol: ProtocolType.Aleo,
      } as ChainMetadata),
    ).toBe(`0x${'00'.repeat(32)}`);
  });
});

function byteRangeHex() {
  return Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString('hex');
}
