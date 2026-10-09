import type { ChainMetadata } from '@hyperlane-xyz/sdk';
import { bufferToBase58, ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test } from 'vitest';

import { buildMessagesByOriginTxQuery } from './build';
import { postgresByteaToAddress, postgresByteaToTxHash, txHashToPostgresBytea } from './encoding';

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

  test('converts aleo transaction ids to bytea hex', () => {
    const metadata = { protocol: ProtocolType.Aleo } as ChainMetadata;

    expect(
      txHashToPostgresBytea(
        'at1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5z5tpwxqergd3c8g7rusqhemxyq',
        metadata,
      ),
    ).toBe(`\\x${byteRangeHex()}`);
  });

  test('converts radix transaction ids to bytea hex', () => {
    const metadata = { protocol: ProtocolType.Radix } as ChainMetadata;

    expect(
      txHashToPostgresBytea(
        'txid_rdx1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5z5tpwxqergd3c8g7rusq30nj38',
        metadata,
      ),
    ).toBe(`\\x${byteRangeHex()}`);
  });
});

describe('buildMessagesByOriginTxQuery', () => {
  test('returns null when origin tx hash cannot be encoded', () => {
    const metadata = { protocol: ProtocolType.Sealevel } as ChainMetadata;

    expect(buildMessagesByOriginTxQuery('not-a-solana-tx', 1399811149, metadata)).toBeNull();
  });

  test('builds an origin transaction query for aleo transaction ids', () => {
    const metadata = { protocol: ProtocolType.Aleo } as ChainMetadata;

    expect(
      buildMessagesByOriginTxQuery(
        'at1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5z5tpwxqergd3c8g7rusqhemxyq',
        1634493807,
        metadata,
      )?.variables,
    ).toEqual({
      originTxHash: `\\x${byteRangeHex()}`,
      originDomainId: 1634493807,
    });
  });
});

describe('postgresByteaToTxHash', () => {
  test('formats protocol-specific transaction hashes like explorer', () => {
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
  test('returns zero byte addresses as hex instead of throwing', () => {
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
