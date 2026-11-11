// Hyperlane Sealevel (Solana) warp route instructions, built by hand from the reference implementation in
// @hyperlane-xyz/sdk 45.0.1 (token/adapters/SealevelTokenAdapter.js, serialization.js, gas/adapters/SealevelIgpAdapter.js,
// core/adapters/SealevelCoreAdapter.js). Only what the bridge needs: TransferRemote on native (SealevelHypNative) and
// collateral (SealevelHypCollateral) routes, the IGP gas quote, PDAs and the dispatch log. Unit-tested in
// sealevel.test.ts. This module pulls in @solana/web3.js: it is only ever loaded through a dynamic import.
import { Buffer } from 'buffer';
import { PublicKey, SystemProgram, type AccountMeta } from '@solana/web3.js';

export const SPL_NOOP = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');
export const ASSOCIATED_TOKEN_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
/** same generous limit the SDK requests (a higher limit does not raise the fee) */
export const TRANSFER_REMOTE_COMPUTE_LIMIT = 1_000_000;
/** TransferRemote = 1 in hyperlane-sealevel-token's Instruction enum */
export const TRANSFER_REMOTE = 1;
/** QuoteGasPayment = 4 in hyperlane-sealevel-igp's Instruction enum */
export const IGP_QUOTE_GAS_PAYMENT = 4;
/** arbitrary 8-byte discriminator in front of every warp token instruction (hyperlane-xyz/issues#462) */
export const TOKEN_IX_DISCRIMINATOR = new Uint8Array(8).fill(1);
/** FeeConfig::DISCRIMINATOR: a warp fee the bridge does not support yet */
const TOKEN_FEE_DISCRIMINATOR = 'TOKFEEV1';
/** plugin data after the token account: native = [bump], collateral = [program, mint, escrow, 2 bumps] */
const PLUGIN_SIZE = { native: 1, collateral: 98 } as const;

export type SealevelKind = 'native' | 'collateral';

const enc = (s: string) => new TextEncoder().encode(s);
const pda = (seeds: (string | Uint8Array)[], program: PublicKey) =>
  PublicKey.findProgramAddressSync(
    seeds.map((x) => Buffer.from(typeof x === 'string' ? enc(x) : x)),
    program,
  )[0];

/** PDA seeds: hyperlane-monorepo rust/sealevel (mailbox pda_seeds.rs, hyperlane-sealevel-token, igp pda_seeds.rs) */
export const derive = {
  tokenAccount: (warp: PublicKey) => pda(['hyperlane_message_recipient', '-', 'handle', '-', 'account_metas'], warp),
  outbox: (mailbox: PublicKey) => pda(['hyperlane', '-', 'outbox'], mailbox),
  dispatchAuthority: (warp: PublicKey) => pda(['hyperlane_dispatcher', '-', 'dispatch_authority'], warp),
  dispatchedMessage: (mailbox: PublicKey, unique: PublicKey) =>
    pda(['hyperlane', '-', 'dispatched_message', '-', unique.toBytes()], mailbox),
  processedMessage: (mailbox: PublicKey, messageId: Uint8Array) =>
    pda(['hyperlane', '-', 'processed_message', '-', messageId], mailbox),
  nativeCollateral: (warp: PublicKey) => pda(['hyperlane_token', '-', 'native_collateral'], warp),
  escrow: (warp: PublicKey) => pda(['hyperlane_token', '-', 'escrow'], warp),
  igpProgramData: (igp: PublicKey) => pda(['hyperlane_igp', '-', 'program_data'], igp),
  gasPayment: (igp: PublicKey, unique: PublicKey) => pda(['hyperlane_igp', '-', 'gas_payment', '-', unique.toBytes()], igp),
  /** associated token account (owner off curve allowed, like the SDK) */
  ata: (owner: PublicKey, mint: PublicKey, tokenProgram: PublicKey) =>
    pda([owner.toBytes(), tokenProgram.toBytes(), mint.toBytes()], ASSOCIATED_TOKEN_PROGRAM),
};

function u32le(n: number) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}
function u64le(n: bigint) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
}
/** borsh u256: 32 bytes little-endian */
function u256le(n: bigint) {
  if (n < 0n || n >= 1n << 256n) throw new Error('amount out of range');
  const b = new Uint8Array(32);
  let x = n;
  for (let i = 0; i < 32; i++) {
    b[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return b;
}

/** [1 x8] ++ borsh { instruction: u8 = 1, destination_domain: u32, recipient: [u8; 32], amount_or_id: u256 } */
export function encodeTransferRemote(destinationDomain: number, recipient: Uint8Array, amount: bigint): Uint8Array {
  if (recipient.length !== 32) throw new Error('recipient must be 32 bytes');
  return new Uint8Array([
    ...TOKEN_IX_DISCRIMINATOR,
    TRANSFER_REMOTE,
    ...u32le(destinationDomain),
    ...recipient,
    ...u256le(amount),
  ]);
}

/** borsh { instruction: u8 = 4, destination_domain: u32, gas_amount: u64 } */
export function encodeIgpQuote(destinationDomain: number, gasAmount: bigint): Uint8Array {
  return new Uint8Array([IGP_QUOTE_GAS_PAYMENT, ...u32le(destinationDomain), ...u64le(gasAmount)]);
}

export interface IgpKeys {
  programId: PublicKey;
  /** the IGP that receives the payment (the inner IGP when an overhead IGP is configured) */
  igpAccount: PublicKey;
  overheadIgpAccount?: PublicKey;
}

export interface TransferKeysInput {
  kind: SealevelKind;
  warp: PublicKey;
  mailbox: PublicKey;
  sender: PublicKey;
  /** fresh keypair's pubkey: the unique message account (it also signs) */
  unique: PublicKey;
  igp?: IgpKeys;
  /** collateral routes: the mint and its token program (SPL Token or Token-2022) */
  collateral?: { mint: PublicKey; tokenProgram: PublicKey };
}

/** Account list of TransferRemote (hyperlane-sealevel-token processor.rs, as SealevelHypTokenAdapter builds it). */
export function transferRemoteKeys(p: TransferKeysInput): AccountMeta[] {
  const ro = (pubkey: PublicKey): AccountMeta => ({ pubkey, isSigner: false, isWritable: false });
  const rw = (pubkey: PublicKey): AccountMeta => ({ pubkey, isSigner: false, isWritable: true });
  const keys: AccountMeta[] = [
    ro(SystemProgram.programId), // 0 system program
    ro(SPL_NOOP), // 1 spl_noop
    ro(derive.tokenAccount(p.warp)), // 2 token PDA
    ro(p.mailbox), // 3 mailbox program
    rw(derive.outbox(p.mailbox)), // 4 mailbox outbox
    ro(derive.dispatchAuthority(p.warp)), // 5 dispatch authority
    { pubkey: p.sender, isSigner: true, isWritable: false }, // 6 sender + payer
    { pubkey: p.unique, isSigner: true, isWritable: false }, // 7 unique message account
    rw(derive.dispatchedMessage(p.mailbox, p.unique)), // 8 message storage PDA
  ];
  if (p.igp) {
    keys.push(ro(p.igp.programId), rw(derive.igpProgramData(p.igp.programId)), rw(derive.gasPayment(p.igp.programId, p.unique)));
    if (p.igp.overheadIgpAccount) keys.push(ro(p.igp.overheadIgpAccount));
    keys.push(rw(p.igp.igpAccount));
  }
  if (p.kind === 'native') {
    keys.push(ro(SystemProgram.programId), rw(derive.nativeCollateral(p.warp)));
  } else {
    if (!p.collateral) throw new Error('collateral route needs the mint');
    const { mint, tokenProgram } = p.collateral;
    keys.push(ro(tokenProgram), rw(mint), rw(derive.ata(p.sender, mint, tokenProgram)), rw(derive.escrow(p.warp)));
  }
  return keys;
}

export interface TokenAccountData {
  decimals: number;
  remoteDecimals: number;
  igp?: { programId: PublicKey; type: number; account: PublicKey };
  destinationGas: Map<number, bigint>;
  remoteRouters: Map<number, Uint8Array>;
  /** bytes the borsh struct used (plugin data and the optional fee config follow) */
  consumed: number;
}

class Reader {
  o = 0;
  constructor(private b: Uint8Array) {}
  private need(n: number) {
    if (this.o + n > this.b.length) throw new Error('account data too short');
  }
  u8() {
    this.need(1);
    return this.b[this.o++];
  }
  u32() {
    this.need(4);
    const v = new DataView(this.b.buffer, this.b.byteOffset + this.o, 4).getUint32(0, true);
    this.o += 4;
    return v;
  }
  u64() {
    this.need(8);
    const v = new DataView(this.b.buffer, this.b.byteOffset + this.o, 8).getBigUint64(0, true);
    this.o += 8;
    return v;
  }
  bytes(n: number) {
    this.need(n);
    const v = this.b.slice(this.o, this.o + n);
    this.o += n;
    return v;
  }
  option<T>(f: () => T): T | undefined {
    return this.u8() === 1 ? f() : undefined;
  }
}

/** HyperlaneToken account (hyperlane-sealevel-token accounts.rs) behind an `initialized: u8` wrapper. */
export function parseTokenAccount(data: Uint8Array): TokenAccountData {
  const r = new Reader(data);
  r.u8(); // initialized
  r.u8(); // bump
  r.bytes(32); // mailbox
  r.bytes(32); // mailbox process authority
  r.u8(); // dispatch authority bump
  const decimals = r.u8();
  const remoteDecimals = r.u8();
  r.option(() => r.bytes(32)); // owner
  r.option(() => r.bytes(32)); // interchain security module
  const igp = r.option(() => ({ programId: new PublicKey(r.bytes(32)), type: r.u8(), account: new PublicKey(r.bytes(32)) }));
  const destinationGas = new Map<number, bigint>();
  for (let n = r.u32(); n > 0; n--) destinationGas.set(r.u32(), r.u64());
  const remoteRouters = new Map<number, Uint8Array>();
  for (let n = r.u32(); n > 0; n--) remoteRouters.set(r.u32(), r.bytes(32));
  return { decimals, remoteDecimals, igp, destinationGas, remoteRouters, consumed: r.o };
}

/** True when the token account carries the optional warp fee config (not supported by this builder yet). */
export function hasTokenFee(data: Uint8Array, consumed: number, kind: SealevelKind) {
  const at = consumed + PLUGIN_SIZE[kind];
  if (data.length < at + 8) return false;
  return new TextDecoder().decode(data.slice(at, at + 8)) === TOKEN_FEE_DISCRIMINATOR;
}

/** Inner IGP of an overhead IGP account: [initialized u8][discriminator 8][bump u8][salt 32][owner Option<32>][inner 32] */
export function parseOverheadIgpInner(data: Uint8Array): PublicKey {
  const r = new Reader(data);
  r.u8();
  r.bytes(8);
  r.u8();
  r.bytes(32);
  r.option(() => r.bytes(32));
  return new PublicKey(r.bytes(32));
}

/** IGP keys of a token account: OverheadIgp (type 1) pays into its inner IGP. */
export function igpKeysOf(t: TokenAccountData, overheadInner?: PublicKey): IgpKeys | undefined {
  if (!t.igp) return undefined;
  if (t.igp.type === 0) return { programId: t.igp.programId, igpAccount: t.igp.account };
  if (t.igp.type === 1) {
    if (!overheadInner) throw new Error('overhead IGP needs its inner IGP');
    return { programId: t.igp.programId, igpAccount: overheadInner, overheadIgpAccount: t.igp.account };
  }
  throw new Error(`Unsupported IGP type ${t.igp.type}`);
}

/** Accounts of the IGP QuoteGasPayment simulation: [system, igp, overhead igp?] */
export function igpQuoteKeys(igp: IgpKeys): AccountMeta[] {
  return [
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: igp.igpAccount, isSigner: false, isWritable: false },
    ...(igp.overheadIgpAccount ? [{ pubkey: igp.overheadIgpAccount, isSigner: false, isWritable: false }] : []),
  ];
}

const DISPATCH_LOG = /Dispatched message to (\d+), ID (0x)?([0-9a-fA-F]{64})/;

/** Message ids from a Solana transaction's logs ("Dispatched message to <domain>, ID <id>", the mailbox's log line). */
export function messageIdsFromLogs(logs: readonly string[]): { destination: number; messageId: `0x${string}` }[] {
  const out: { destination: number; messageId: `0x${string}` }[] = [];
  for (const l of logs) {
    const m = DISPATCH_LOG.exec(l);
    if (m) out.push({ destination: Number(m[1]), messageId: `0x${m[3].toLowerCase()}` });
  }
  return out;
}

/** The IGP quote simulation's return data: u64 payment_quote (+ a trailing byte). */
export function parseIgpQuote(returnData: Uint8Array): bigint {
  if (returnData.length < 8) throw new Error('no IGP quote');
  return new DataView(returnData.buffer, returnData.byteOffset, 8).getBigUint64(0, true);
}
