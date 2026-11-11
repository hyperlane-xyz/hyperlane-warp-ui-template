// Solana side of the bridge: quote, build + send TransferRemote, read the message id, check delivery on Solana.
// Loaded only through `import('../solana/sealevelClient')` when a Solana route is used, so @solana/web3.js stays out of
// the main bundle.
import { Buffer } from 'buffer';
import { ComputeBudgetProgram, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { hexToBytes, type Hex } from 'viem';

import { CHAINS } from '../config/chains';
import type { McToken } from '../config/multichain';
import { getAccount, getLatestBlockhash, getTx, lastSignatureFor, simulate, toBase64 } from './rpc';
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
  transferRemoteKeys,
  TRANSFER_REMOTE_COMPUTE_LIMIT,
  type SealevelKind,
} from './sealevel';
import { signAndSendSolana } from './wallet';

const mailbox = () => new PublicKey(CHAINS.solanadevnet.mailbox);

function kindOf(t: McToken): SealevelKind {
  if (t.tokenType === 'native' || t.tokenType === 'collateral') return t.tokenType;
  throw new Error(`Solana ${t.tokenType} routes are not supported by the bridge yet`);
}

async function loadRoute(t: McToken) {
  if (!t.address) throw new Error('Coming soon');
  const kind = kindOf(t);
  const warp = new PublicKey(t.address);
  const acct = await getAccount(derive.tokenAccount(warp).toBase58());
  if (!acct) throw new Error('This route is not on Solana yet');
  const data = parseTokenAccount(acct.data);
  if (hasTokenFee(acct.data, data.consumed, kind)) throw new Error('This route charges a fee the bridge does not support yet');
  let inner: PublicKey | undefined;
  if (data.igp?.type === 1) {
    const o = await getAccount(data.igp.account.toBase58());
    if (!o) throw new Error('Gas paymaster account not found');
    inner = parseOverheadIgpInner(o.data);
  }
  const igp = igpKeysOf(data, inner);
  let collateral: { mint: PublicKey; tokenProgram: PublicKey } | undefined;
  if (kind === 'collateral') {
    if (!t.collateralAddress) throw new Error('Unknown token mint');
    const mint = new PublicKey(t.collateralAddress);
    const m = await getAccount(mint.toBase58());
    if (!m) throw new Error('Token mint not found');
    collateral = { mint, tokenProgram: new PublicKey(m.owner) };
  }
  return { kind, warp, data, igp, collateral };
}

/** Delivery fee (lamports) the transfer pays the gas paymaster; gas undefined when it cannot be simulated. */
export async function quoteFromSolana(t: McToken, destination: number, sender?: string): Promise<{ gas?: bigint }> {
  const r = await loadRoute(t);
  const gasAmount = r.data.destinationGas.get(destination);
  if (!r.igp || gasAmount === undefined) return { gas: 0n };
  if (!sender) return {};
  const ix = new TransactionInstruction({
    programId: r.igp.programId,
    keys: igpQuoteKeys(r.igp),
    data: Buffer.from(encodeIgpQuote(destination, gasAmount)),
  });
  const tx = new Transaction();
  tx.feePayer = new PublicKey(sender);
  tx.recentBlockhash = PublicKey.default.toBase58(); // replaced by the node (replaceRecentBlockhash)
  tx.add(ix);
  const sim = await simulate(toBase64(tx.serialize({ requireAllSignatures: false, verifySignatures: false })));
  if (sim.err || !sim.returnData) return {};
  return { gas: parseIgpQuote(sim.returnData) };
}

/** Unsigned (by the wallet) TransferRemote transaction; the unique message keypair has already signed. */
export async function buildTransferTx(t: McToken, destination: number, recipient: Uint8Array, amount: bigint, sender: string) {
  const r = await loadRoute(t);
  const unique = Keypair.generate();
  const senderPk = new PublicKey(sender);
  const ix = new TransactionInstruction({
    programId: r.warp,
    keys: transferRemoteKeys({ kind: r.kind, warp: r.warp, mailbox: mailbox(), sender: senderPk, unique: unique.publicKey, igp: r.igp, collateral: r.collateral }),
    data: Buffer.from(encodeTransferRemote(destination, recipient, amount)),
  });
  const tx = new Transaction();
  tx.feePayer = senderPk;
  tx.recentBlockhash = await getLatestBlockhash();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: TRANSFER_REMOTE_COMPUTE_LIMIT }), ix);
  tx.partialSign(unique);
  return {
    bytes: new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false })),
    unique: unique.publicKey.toBase58(),
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls the confirmed transaction and returns the Hyperlane message id from the mailbox's dispatch log. */
export async function messageIdOf(signature: string, timeoutMs = 90_000): Promise<Hex | undefined> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const tx = await getTx(signature).catch(() => null);
    if (tx) {
      if (tx.err) throw new Error('The transaction failed on Solana');
      return messageIdsFromLogs(tx.logs)[0]?.messageId;
    }
    await wait(2000);
  }
  return undefined;
}

/** Builds, has the connected Solana wallet sign and send, and returns the signature. */
export async function sendFromSolana(t: McToken, destination: number, recipient: Uint8Array, amount: bigint, sender: string) {
  const { bytes } = await buildTransferTx(t, destination, recipient, amount, sender);
  return signAndSendSolana(bytes);
}

/** Gully -> Solana: delivered once the mailbox's processed-message PDA exists; tx = the transaction that wrote it. */
export async function deliveredOnSolana(messageId: Hex): Promise<{ delivered: boolean; tx?: string }> {
  const pda = derive.processedMessage(mailbox(), hexToBytes(messageId)).toBase58();
  const acct = await getAccount(pda);
  if (!acct?.data.length) return { delivered: false };
  return { delivered: true, tx: await lastSignatureFor(pda).catch(() => undefined) };
}
