import type { ChainMetadata } from '@hyperlane-xyz/sdk';
import { bufferToBase58, ProtocolType } from '@hyperlane-xyz/utils';
import { describe, expect, test } from 'vitest';

import { buildMessagesByOriginTxQuery } from './build';
import {
  hexToProtocolAddress,
  postgresByteaToAddress,
  postgresByteaToTxHash,
  txHashToPostgresBytea,
} from './encoding';

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

describe('hexToProtocolAddress', () => {
  test('decodes EVM recipients to checksummed 20-byte addresses', () => {
    const recipient = `0x${'00'.repeat(12)}52908400098527886e0f7030069857d2e4169ee7`;
    expect(
      hexToProtocolAddress(recipient, { protocol: ProtocolType.Ethereum } as ChainMetadata),
    ).toBe('0x52908400098527886E0F7030069857D2E4169EE7');
  });

  test('preserves all recipient bytes for Solana and Cosmos contracts', () => {
    const recipient = `0x${byteRangeHex()}`;
    expect(
      hexToProtocolAddress(recipient, { protocol: ProtocolType.Sealevel } as ChainMetadata),
    ).toBe('4wBqpZM9xaSheZzJSMawUKKwhdpChKbZ5eu5ky4Vigw');
    expect(
      hexToProtocolAddress(recipient, {
        protocol: ProtocolType.Cosmos,
        bech32Prefix: 'osmo',
      } as ChainMetadata),
    ).toBe('osmo1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5z5tpwxqergd3c8g7rusq4z5ese');
  });

  test('removes account padding for Cosmos Native using the destination prefix', () => {
    const recipient = `0x${'00'.repeat(12)}${'42'.repeat(20)}`;
    expect(
      hexToProtocolAddress(recipient, {
        protocol: ProtocolType.CosmosNative,
        bech32Prefix: 'osmo',
      } as ChainMetadata),
    ).toBe('osmo1gfpyysjzgfpyysjzgfpyysjzgfpyysjz22cjjt');
  });

  test('keeps raw hex when metadata is missing or the recipient is zero', () => {
    const recipient = `0x${byteRangeHex()}`;
    expect(hexToProtocolAddress(recipient, undefined)).toBe(recipient);
    expect(hexToProtocolAddress(recipient, null)).toBe(recipient);
    const zero = `0x${'00'.repeat(32)}`;
    expect(hexToProtocolAddress(zero, { protocol: ProtocolType.Sealevel } as ChainMetadata)).toBe(
      zero,
    );
  });
});

function byteRangeHex() {
  return Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString('hex');
}
