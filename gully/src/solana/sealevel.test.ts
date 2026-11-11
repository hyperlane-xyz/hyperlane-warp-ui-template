import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { bytesToHex } from 'viem';
import { describe, expect, it } from 'vitest';

import { base58Decode, base58Encode, isSolanaAddress, solanaRecipientBytes32 } from './base58';
import {
  derive,
  encodeIgpQuote,
  encodeTransferRemote,
  hasTokenFee,
  igpKeysOf,
  igpQuoteKeys,
  messageIdsFromLogs,
  parseIgpQuote,
  parseOverheadIgpInner,
  parseTokenAccount,
  SPL_NOOP,
  transferRemoteKeys,
} from './sealevel';

const key = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

describe('Sealevel TransferRemote instruction data', () => {
  it('is [1 x8] ++ u8 1 ++ u32le domain ++ recipient ++ u256le amount', () => {
    const recipient = Uint8Array.from({ length: 32 }, (_, i) => i);
    const d = encodeTransferRemote(485590, recipient, 1_000_000_000n);
    expect(d.length).toBe(77);
    expect(hex(d.slice(0, 8))).toBe('0101010101010101');
    expect(d[8]).toBe(1);
    expect(hex(d.slice(9, 13))).toBe('d6680700'); // 485590 = 0x000768d6
    expect(Array.from(d.slice(13, 45))).toEqual(Array.from(recipient));
    expect(hex(d.slice(45, 49))).toBe('00ca9a3b'); // 1e9
    expect(d.slice(49).every((x) => x === 0)).toBe(true);
  });

  it('carries an EVM recipient as its 32-byte padded form', () => {
    const r = new Uint8Array(32);
    r.set(Buffer.from('474D721C3B6c555E6F188dCCE7f0b165F1CD8631', 'hex'), 12);
    const d = encodeTransferRemote(485590, r, 1n);
    expect(hex(d.slice(13, 45))).toBe('000000000000000000000000474d721c3b6c555e6f188dcce7f0b165f1cd8631');
  });

  it('rejects a recipient that is not 32 bytes and amounts out of range', () => {
    expect(() => encodeTransferRemote(1, new Uint8Array(20), 1n)).toThrow();
    expect(() => encodeTransferRemote(1, new Uint8Array(32), -1n)).toThrow();
  });

  it('IGP QuoteGasPayment data: u8 4 ++ u32le domain ++ u64le gas', () => {
    expect(hex(encodeIgpQuote(485590, 64_000n))).toBe('04' + 'd6680700' + '00fa000000000000');
  });
});

describe('Sealevel TransferRemote accounts', () => {
  const warp = key(1);
  const mailbox = key(2);
  const sender = key(3);
  const unique = key(4);

  it('native route, no IGP: 9 base accounts, then system program + native collateral PDA', () => {
    const k = transferRemoteKeys({ kind: 'native', warp, mailbox, sender, unique });
    expect(k).toHaveLength(11);
    expect(k[0].pubkey.equals(SystemProgram.programId)).toBe(true);
    expect(k[1].pubkey.equals(SPL_NOOP)).toBe(true);
    expect(k[2].pubkey.equals(derive.tokenAccount(warp))).toBe(true);
    expect(k[3].pubkey.equals(mailbox)).toBe(true);
    expect(k[4]).toMatchObject({ isWritable: true });
    expect(k[4].pubkey.equals(derive.outbox(mailbox))).toBe(true);
    expect(k[5].pubkey.equals(derive.dispatchAuthority(warp))).toBe(true);
    expect(k[6]).toMatchObject({ pubkey: sender, isSigner: true, isWritable: false });
    expect(k[7]).toMatchObject({ pubkey: unique, isSigner: true, isWritable: false });
    expect(k[8].pubkey.equals(derive.dispatchedMessage(mailbox, unique))).toBe(true);
    expect(k[8].isWritable).toBe(true);
    expect(k[9].pubkey.equals(SystemProgram.programId)).toBe(true);
    expect(k[10].pubkey.equals(derive.nativeCollateral(warp))).toBe(true);
    expect(k[10].isWritable).toBe(true);
    expect(k.filter((x) => x.isSigner)).toHaveLength(2);
  });

  it('collateral route with an overhead IGP: IGP section, then token program, mint, sender ATA, escrow', () => {
    const igp = { programId: key(5), igpAccount: key(6), overheadIgpAccount: key(7) };
    const mint = key(8);
    const tokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    const k = transferRemoteKeys({ kind: 'collateral', warp, mailbox, sender, unique, igp, collateral: { mint, tokenProgram } });
    expect(k).toHaveLength(18);
    expect(k[9]).toMatchObject({ pubkey: igp.programId, isWritable: false });
    expect(k[10].pubkey.equals(derive.igpProgramData(igp.programId))).toBe(true);
    expect(k[10].isWritable).toBe(true);
    expect(k[11].pubkey.equals(derive.gasPayment(igp.programId, unique))).toBe(true);
    expect(k[12]).toMatchObject({ pubkey: igp.overheadIgpAccount, isWritable: false });
    expect(k[13]).toMatchObject({ pubkey: igp.igpAccount, isWritable: true });
    expect(k[14]).toMatchObject({ pubkey: tokenProgram, isWritable: false });
    expect(k[15]).toMatchObject({ pubkey: mint, isWritable: true });
    expect(k[16].pubkey.equals(derive.ata(sender, mint, tokenProgram))).toBe(true);
    expect(k[17].pubkey.equals(derive.escrow(warp))).toBe(true);
  });

  it('plain IGP: no overhead account', () => {
    const k = transferRemoteKeys({ kind: 'native', warp, mailbox, sender, unique, igp: { programId: key(5), igpAccount: key(6) } });
    expect(k).toHaveLength(15);
    expect(k[12]).toMatchObject({ pubkey: key(6), isWritable: true });
  });

  it('a collateral route without its mint is refused', () => {
    expect(() => transferRemoteKeys({ kind: 'collateral', warp, mailbox, sender, unique })).toThrow();
  });

  it('the associated token account matches the SPL derivation of a known wallet', () => {
    // USDC mint + a wallet, ATA as computed by @solana/spl-token getAssociatedTokenAddressSync
    const owner = new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
    const mint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    const tp = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    const [expected] = PublicKey.findProgramAddressSync(
      [owner.toBuffer(), tp.toBuffer(), mint.toBuffer()],
      new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
    );
    expect(derive.ata(owner, mint, tp).equals(expected)).toBe(true);
  });
});

describe('Sealevel account parsing', () => {
  const u32 = (n: number) => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n);
    return b;
  };
  const u64 = (n: bigint) => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(n);
    return b;
  };
  const token = Buffer.concat([
    Buffer.from([1, 255]),
    key(2).toBuffer(),
    key(9).toBuffer(),
    Buffer.from([254, 9, 18]),
    Buffer.from([1]),
    key(10).toBuffer(), // owner Some
    Buffer.from([0]), // ism None
    Buffer.from([1]),
    key(5).toBuffer(),
    Buffer.from([1]),
    key(7).toBuffer(), // igp Some(OverheadIgp)
    u32(1),
    u32(485590),
    u64(68_000n),
    u32(1),
    u32(485590),
    Buffer.alloc(32, 0xab),
  ]);

  it('reads the HyperlaneToken account', () => {
    const t = parseTokenAccount(token);
    expect(t.decimals).toBe(9);
    expect(t.remoteDecimals).toBe(18);
    expect(t.igp?.type).toBe(1);
    expect(t.igp?.programId.equals(key(5))).toBe(true);
    expect(t.igp?.account.equals(key(7))).toBe(true);
    expect(t.destinationGas.get(485590)).toBe(68_000n);
    expect(hex(t.remoteRouters.get(485590)!)).toBe('ab'.repeat(32));
    expect(t.consumed).toBe(token.length);
  });

  it('spots the optional warp fee config after the plugin data', () => {
    const t = parseTokenAccount(token);
    expect(hasTokenFee(token, t.consumed, 'native')).toBe(false);
    const withFee = Buffer.concat([token, Buffer.from([7]), Buffer.from('TOKFEEV1'), Buffer.alloc(64)]);
    expect(hasTokenFee(withFee, t.consumed, 'native')).toBe(true);
    expect(hasTokenFee(withFee, t.consumed, 'collateral')).toBe(false);
  });

  it('reads the inner IGP of an overhead IGP and builds the payment keys', () => {
    const overhead = Buffer.concat([Buffer.from([1]), Buffer.alloc(8, 3), Buffer.from([250]), Buffer.alloc(32, 4), Buffer.from([0]), key(6).toBuffer(), u32(0)]);
    const inner = parseOverheadIgpInner(overhead);
    expect(inner.equals(key(6))).toBe(true);
    const k = igpKeysOf(parseTokenAccount(token), inner)!;
    expect(k.igpAccount.equals(key(6))).toBe(true);
    expect(k.overheadIgpAccount?.equals(key(7))).toBe(true);
    expect(igpQuoteKeys(k).map((m) => m.pubkey.toBase58())).toEqual([SystemProgram.programId.toBase58(), key(6).toBase58(), key(7).toBase58()]);
  });

  it('reads the IGP quote return data', () => {
    expect(parseIgpQuote(Buffer.concat([u64(123_456n), Buffer.from([1])]))).toBe(123_456n);
  });
});

describe('Solana message id', () => {
  it('comes from the mailbox dispatch log', () => {
    const id = 'ab'.repeat(32);
    const logs = [
      'Program 5yM5YrrzHCrp4ZPLKN9Y2eUAqEWsTbBqaorgbngQcR54 invoke [2]',
      `Program log: Dispatched message to 485590, ID 0x${id}`,
      'Program log: Paid IGP',
    ];
    expect(messageIdsFromLogs(logs)).toEqual([{ destination: 485590, messageId: `0x${id}` }]);
    expect(messageIdsFromLogs([`Program log: Dispatched message to 485590, ID ${id.toUpperCase()}`])[0].messageId).toBe(`0x${id}`);
    expect(messageIdsFromLogs(['Program log: nothing'])).toEqual([]);
  });
});

describe('base58 (Solana addresses)', () => {
  it('round-trips against @solana/web3.js', () => {
    for (let i = 0; i < 20; i++) {
      const pk = Keypair.generate().publicKey;
      expect(Array.from(base58Decode(pk.toBase58()))).toEqual(Array.from(pk.toBytes()));
      expect(base58Encode(pk.toBytes())).toBe(pk.toBase58());
    }
    expect(base58Encode(new Uint8Array(32))).toBe('11111111111111111111111111111111');
  });

  it('turns a Solana address into the bytes32 recipient (Gully -> Solana)', () => {
    expect(solanaRecipientBytes32('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')).toBe(
      '0x06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9',
    );
    expect(solanaRecipientBytes32('11111111111111111111111111111111')).toBe(bytesToHex(new Uint8Array(32)));
    expect(isSolanaAddress('0x474D721C3B6c555E6F188dCCE7f0b165F1CD8631')).toBe(false);
    expect(() => solanaRecipientBytes32('not-base58!')).toThrow();
  });
});
