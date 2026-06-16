import { ProviderType } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { Modal } from '@hyperlane-xyz/widgets';
import {
  useAccountAddressForChain,
  useTransactionFns,
} from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import {
  AccountMeta,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

import { useMultiProvider } from '../chains/hooks';
import { TransactionHistoryItemType, useStore } from '../store';
import { SwapStatus } from './types';
import type { SolanaRevealData } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey('2CttnaLkYbNHbaFDFnQ8PMCnzUwTGrKnskBxPM4TRWGp');
const RAYDIUM_CLMM_PROG = new PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK');
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROG = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const ATA_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const PENDING_SWAP_SEED = Buffer.from('pending_swap');
const FEE_PAYER_SEED = Buffer.from('hyperlane_fee_payer');
const CLMM_DISC = Buffer.from([247, 237, 227, 245, 215, 195, 222, 70]);
const RAYDIUM_FEE_TO_TICK_SPACING: Record<number, number> = {
  100: 1,
  500: 10,
  2500: 60,
  3000: 60,
  10000: 200,
};
// ── Types ────────────────────────────────────────────────────────────────────

interface ClmmHop {
  poolId: string;
  inputMint: string;
  outputMint: string;
  remainingAccounts?: string[] | null;
  ammConfig?: string;
  mint0?: string;
  mint1?: string;
  vault0?: string;
  vault1?: string;
  observationState?: string;
  tickSpacing?: number;
  tickCurrent?: number;
  feeRate?: number;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SolanaRevealModal() {
  const transactionHistory = useStore((s) => s.transactionHistory);
  const dismissSolanaReveal = useStore((s) => s.dismissSolanaReveal);
  const updateSwapTransactionStatus = useStore((s) => s.updateSwapTransactionStatus);
  const multiProvider = useMultiProvider();
  const transactionFns = useTransactionFns(multiProvider);

  // Show when warp delivery detected (ConfirmingDestination) and reveal not yet done/dismissed.
  const pending = useMemo(() => {
    for (const item of transactionHistory) {
      if (item.type !== TransactionHistoryItemType.Swap) continue;
      if (item.data.status !== SwapStatus.ConfirmingDestination) continue;
      if (!item.data.solanaReveal || item.data.revealDismissed) continue;
      return { id: item.id, data: item.data };
    }
    return null;
  }, [transactionHistory]);

  const [isRevealing, setIsRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  const revealData = pending?.data.solanaReveal;
  const dstChain = pending?.data.dstChain;
  const dstChainName = dstChain
    ? (multiProvider.tryGetChainName(dstChain) ?? undefined)
    : undefined;
  const rpcUrl = dstChainName
    ? multiProvider.tryGetChainMetadata(dstChainName)?.rpcUrls?.[0]?.http
    : undefined;
  const solanaAddress = useAccountAddressForChain(multiProvider, dstChainName);

  // Reset state when pending swap changes
  useEffect(() => {
    setRevealError(null);
    setIsRevealing(false);
  }, [pending?.id]);

  const handleDismiss = useCallback(() => {
    if (pending) dismissSolanaReveal(pending.id);
  }, [pending, dismissSolanaReveal]);

  const handleReveal = useCallback(async () => {
    if (!pending || !revealData || !rpcUrl || !dstChainName) return;
    const fns = transactionFns[ProtocolType.Sealevel as keyof typeof transactionFns];
    if (!fns) {
      setRevealError('Solana wallet not connected');
      return;
    }
    if (!solanaAddress) {
      setRevealError('Connect a Solana wallet first');
      return;
    }

    setIsRevealing(true);
    setRevealError(null);
    try {
      const conn = new Connection(rpcUrl, 'confirmed');
      const walletPk = new PublicKey(solanaAddress);
      const tx = await buildRevealTransaction(revealData, walletPk, conn);

      const { hash, confirm } = await fns.sendTransaction({
        tx: {
          type: ProviderType.SolanaWeb3,
          transaction: tx,
          category: 'transfer',
        } as Parameters<typeof fns.sendTransaction>[0]['tx'],
        chainName: dstChainName,
      });

      await confirm();
      updateSwapTransactionStatus(pending.id, SwapStatus.ConfirmedDestination, {
        destinationTxHash: hash,
      });
      toast.success('Reveal submitted! Swap complete.');
    } catch (err) {
      setRevealError((err as Error).message ?? 'Reveal failed');
    } finally {
      setIsRevealing(false);
    }
  }, [
    pending,
    revealData,
    rpcUrl,
    dstChainName,
    solanaAddress,
    transactionFns,
    updateSwapTransactionStatus,
  ]);

  const isOpen = !!pending;

  return (
    <Modal isOpen={isOpen} close={handleDismiss} panelClassname="max-w-sm" dialogProps={{ onClose: () => {} }}>
      <div className="flex flex-col gap-4 p-4">
        <h2 className="text-lg font-semibold">Reveal Solana Swap</h2>
        <div className="rounded border border-yellow-400 bg-yellow-50 p-3 text-sm text-yellow-800">
          <strong>Demo only.</strong> In production the relayer would submit this automatically, to
          keep changes for the POC minimal you are submitting the reveal transaction manually
          completing the destination swap.
        </div>
        {revealData && (
          <div className="text-sm text-gray-600">
            <div>
              <span className="font-medium">Input mint: </span>
              <span className="font-mono text-xs">{revealData.tokenIn}</span>
            </div>
            <div>
              <span className="font-medium">Output mint: </span>
              <span className="font-mono text-xs">{revealData.tokenOut}</span>
            </div>
            <div>
              <span className="font-medium">Amount: </span>
              {revealData.amountIn}
            </div>
          </div>
        )}
        {revealError && <div className="text-sm text-red-600">{revealError}</div>}
        <div className="flex gap-3">
          <button
            onClick={handleDismiss}
            disabled={isRevealing}
            className="flex-1 rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReveal}
            disabled={isRevealing}
            className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isRevealing ? 'Submitting…' : 'Reveal'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function buildRevealTransaction(
  r: SolanaRevealData,
  walletPk: PublicKey,
  conn: Connection,
): Promise<Transaction> {
  const commitmentBytes = Buffer.from(r.commitment.replace('0x', ''), 'hex');
  const calldataBytes = Buffer.from(r.calldata.replace('0x', ''), 'hex');

  let saltBytes: Buffer;
  if (r.revealSalt) {
    saltBytes = Buffer.from(r.revealSalt.replace('0x', ''), 'hex');
  } else {
    saltBytes = normaliseSalt(r.evmSender);
  }

  const originLE = Buffer.alloc(4);
  originLE.writeUInt32LE(r.srcChainId, 0);
  const evmUrBytes = Buffer.alloc(32);
  Buffer.from(r.evmUr, 'hex').copy(evmUrBytes, 12);

  const [pendingSwapPDA] = PublicKey.findProgramAddressSync(
    [PENDING_SWAP_SEED, originLE, evmUrBytes, commitmentBytes],
    PROGRAM_ID,
  );
  const [feePayerPDA] = PublicKey.findProgramAddressSync([FEE_PAYER_SEED], PROGRAM_ID);

  const [pdaInfo, inMintAcct, outMintAcct] = await Promise.all([
    conn.getAccountInfo(pendingSwapPDA),
    conn.getAccountInfo(new PublicKey(r.tokenIn)),
    conn.getAccountInfo(new PublicKey(r.tokenOut)),
  ]);

  if (!pdaInfo) throw new Error('Pending swap PDA not found — commit not yet delivered');
  if (!inMintAcct) throw new Error(`Input mint not found: ${r.tokenIn}`);
  if (!outMintAcct) throw new Error(`Output mint not found: ${r.tokenOut}`);

  const inTokenProg = inMintAcct.owner.equals(TOKEN_2022_PROG) ? TOKEN_2022_PROG : TOKEN_PROGRAM;
  const outTokenProg = outMintAcct.owner.equals(TOKEN_2022_PROG) ? TOKEN_2022_PROG : TOKEN_PROGRAM;
  const recipientPk = new PublicKey(pdaInfo.data.subarray(0, 32));
  const pdaInputAta = findATA(pendingSwapPDA, new PublicKey(r.tokenIn), inTokenProg);

  // Raydium quote with retry
  let hop: ClmmHop | undefined;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const data = await fetchRaydiumQuote(r.tokenIn, r.tokenOut, BigInt(r.amountIn));
    if (!data) throw new Error('Raydium API returned no data');
    const candidate: ClmmHop = data.routePlan[0] as ClmmHop;
    if (candidate.outputMint === r.tokenOut) {
      hop = candidate;
      break;
    }
    if (attempt === 5)
      throw new Error(
        `Raydium never returned correct outputMint (expected ${r.tokenOut}, got ${candidate.outputMint})`,
      );
    await new Promise<void>((res) => setTimeout(res, 500));
  }
  if (!hop) throw new Error('No Raydium route found');

  const poolState = await fetchClmmPoolState(hop.poolId, conn);
  if (!poolState) throw new Error(`Pool ${hop.poolId} not found on-chain`);
  hop = { ...hop, ...poolState };

  const inputIsMint0 = hop.mint0 ? r.tokenIn === hop.mint0 : true;
  const actualOutputMint = inputIsMint0 ? (hop.mint1 ?? r.tokenOut) : (hop.mint0 ?? r.tokenOut);

  let actualOutTokenProg = outTokenProg;
  if (actualOutputMint !== r.tokenOut) {
    const acct = await conn.getAccountInfo(new PublicKey(actualOutputMint));
    if (!acct) throw new Error(`Actual output mint not found: ${actualOutputMint}`);
    actualOutTokenProg = acct.owner.equals(TOKEN_2022_PROG) ? TOKEN_2022_PROG : TOKEN_PROGRAM;
  }
  hop.outputMint = actualOutputMint;

  const pdaOutputAta = findATA(pendingSwapPDA, new PublicKey(actualOutputMint), actualOutTokenProg);
  const recipientOutAta = findATA(recipientPk, new PublicKey(actualOutputMint), actualOutTokenProg);

  // Build instruction data (Borsh variant 2 — Reveal)
  const ixBuf = Buffer.alloc(1 + 4 + 32 + 4 + calldataBytes.length + 32);
  let off = 0;
  ixBuf[off++] = 2;
  ixBuf.writeUInt32LE(r.srcChainId, off);
  off += 4;
  evmUrBytes.copy(ixBuf, off);
  off += 32;
  ixBuf.writeUInt32LE(calldataBytes.length, off);
  off += 4;
  calldataBytes.copy(ixBuf, off);
  off += calldataBytes.length;
  saltBytes.copy(ixBuf, off);

  const clmmAccts = buildClmmAccounts(pendingSwapPDA, hop, inTokenProg, actualOutTokenProg);
  const sweepAccts: AccountMeta[] = [
    { pubkey: pdaOutputAta, isSigner: false, isWritable: true },
    { pubkey: recipientOutAta, isSigner: false, isWritable: true },
    { pubkey: new PublicKey(actualOutputMint), isSigner: false, isWritable: false },
    { pubkey: actualOutTokenProg, isSigner: false, isWritable: false },
  ];

  const keys: AccountMeta[] = [
    { pubkey: walletPk, isSigner: true, isWritable: true },
    { pubkey: pendingSwapPDA, isSigner: false, isWritable: true },
    { pubkey: pdaInputAta, isSigner: false, isWritable: true },
    { pubkey: feePayerPDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ...clmmAccts,
    ...sweepAccts,
  ];

  const makeAtaIx = (owner: PublicKey, ata: PublicKey) =>
    new TransactionInstruction({
      programId: ATA_PROGRAM,
      keys: [
        { pubkey: walletPk, isSigner: true, isWritable: true },
        { pubkey: ata, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: new PublicKey(actualOutputMint), isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: actualOutTokenProg, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([1]),
    });

  const revealIx = new TransactionInstruction({ programId: PROGRAM_ID, keys, data: ixBuf });

  const { blockhash } = await conn.getLatestBlockhash();
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: walletPk });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }));
  tx.add(makeAtaIx(pendingSwapPDA, pdaOutputAta));     // CLMM needs this pre-initialized
  tx.add(makeAtaIx(recipientPk, recipientOutAta));     // sweep needs this pre-initialized
  tx.add(revealIx);
  return tx;
}

function normaliseSalt(addr: string): Buffer {
  const s = addr.replace(/^0x/i, '').toLowerCase();
  if (s.length === 64) return Buffer.from(s, 'hex');
  if (s.length === 40) return Buffer.from('000000000000000000000000' + s, 'hex');
  throw new Error(`Cannot normalise salt from address: ${addr}`);
}

function findATA(
  owner: PublicKey,
  mint: PublicKey,
  tokenProg: PublicKey = TOKEN_PROGRAM,
): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProg.toBuffer(), mint.toBuffer()],
    ATA_PROGRAM,
  );
  return ata;
}

function getTickArrayStartIndex(tickCurrent: number, tickSpacing: number): number {
  const ticksInArray = 60 * tickSpacing;
  let start = Math.trunc(tickCurrent / ticksInArray) * ticksInArray;
  if (tickCurrent < 0 && tickCurrent % ticksInArray !== 0) start -= ticksInArray;
  return start;
}

function computeTickArrayAddress(poolId: string, startIndex: number): PublicKey {
  const buf = Buffer.alloc(4);
  buf.writeInt32BE(startIndex, 0);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('tick_array'), new PublicKey(poolId).toBuffer(), buf],
    RAYDIUM_CLMM_PROG,
  );
  return pda;
}

function buildClmmAccounts(
  payerPk: PublicKey,
  hop: ClmmHop,
  inTokenProg: PublicKey,
  outTokenProg: PublicKey,
): AccountMeta[] {
  const inMint = new PublicKey(hop.inputMint);
  const outMint = new PublicKey(hop.outputMint);
  const inAta = findATA(payerPk, inMint, inTokenProg);
  const outAta = findATA(payerPk, outMint, outTokenProg);

  const ammCfg = new PublicKey(hop.ammConfig ?? hop.poolId);
  const pool = new PublicKey(hop.poolId);
  const obs = new PublicKey(hop.observationState ?? hop.poolId);

  const inputIsMint0 = hop.mint0 ? hop.inputMint === hop.mint0 : true;
  const inVault = new PublicKey(
    inputIsMint0 ? (hop.vault0 ?? hop.poolId) : (hop.vault1 ?? hop.poolId),
  );
  const outVault = new PublicKey(
    inputIsMint0 ? (hop.vault1 ?? hop.poolId) : (hop.vault0 ?? hop.poolId),
  );

  const ta = hop.remainingAccounts ?? [];
  const tickSpacing = hop.tickSpacing ?? RAYDIUM_FEE_TO_TICK_SPACING[hop.feeRate ?? 0] ?? 60;
  const tickCurrent = hop.tickCurrent ?? 0;
  const ticksInArray = 60 * tickSpacing;
  const start0 = getTickArrayStartIndex(tickCurrent, tickSpacing);
  const ta0 = ta[0] ? new PublicKey(ta[0]) : computeTickArrayAddress(hop.poolId, start0);
  const ta1 = ta[1]
    ? new PublicKey(ta[1])
    : computeTickArrayAddress(hop.poolId, start0 + ticksInArray);
  const ta2 = ta[2]
    ? new PublicKey(ta[2])
    : computeTickArrayAddress(hop.poolId, start0 + 2 * ticksInArray);

  return [
    { pubkey: payerPk, isSigner: false, isWritable: true },
    { pubkey: ammCfg, isSigner: false, isWritable: false },
    { pubkey: pool, isSigner: false, isWritable: true },
    { pubkey: inAta, isSigner: false, isWritable: true },
    { pubkey: outAta, isSigner: false, isWritable: true },
    { pubkey: inVault, isSigner: false, isWritable: true },
    { pubkey: outVault, isSigner: false, isWritable: true },
    { pubkey: obs, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: TOKEN_2022_PROG, isSigner: false, isWritable: false },
    { pubkey: MEMO_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: inMint, isSigner: false, isWritable: false },
    { pubkey: outMint, isSigner: false, isWritable: false },
    { pubkey: ta0, isSigner: false, isWritable: true },
    { pubkey: ta1, isSigner: false, isWritable: true },
    { pubkey: ta2, isSigner: false, isWritable: true },
    { pubkey: RAYDIUM_CLMM_PROG, isSigner: false, isWritable: false },
  ];
}

async function fetchRaydiumQuote(
  tokenIn: string,
  tokenOut: string,
  amount: bigint,
): Promise<{ routePlan: ClmmHop[] } | null> {
  const url = new URL('https://transaction-v1.raydium.io/compute/swap-base-in');
  url.searchParams.set('inputMint', tokenIn);
  url.searchParams.set('outputMint', tokenOut);
  url.searchParams.set('amount', amount.toString());
  url.searchParams.set('slippageBps', '100');
  url.searchParams.set('txVersion', 'LEGACY');
  url.searchParams.set('onlyDirectRoute', 'true');
  try {
    const res = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json' } });
    const j = (await res.json()) as { success: boolean; data: { routePlan: ClmmHop[] } };
    return j.success ? j.data : null;
  } catch {
    return null;
  }
}

async function fetchClmmPoolState(
  poolId: string,
  conn: Connection,
): Promise<Partial<ClmmHop> | null> {
  try {
    const acct = await conn.getAccountInfo(new PublicKey(poolId));
    if (!acct) return null;
    const raw = Buffer.from(acct.data);
    if (raw.length < 285 || !raw.subarray(0, 8).equals(CLMM_DISC)) return null;
    const pkStr = (b: Buffer) => new PublicKey(b).toBase58();
    return {
      ammConfig: pkStr(raw.subarray(9, 41)),
      mint0: pkStr(raw.subarray(73, 105)),
      mint1: pkStr(raw.subarray(105, 137)),
      vault0: pkStr(raw.subarray(137, 169)),
      vault1: pkStr(raw.subarray(169, 201)),
      observationState: pkStr(raw.subarray(201, 233)),
      tickSpacing: raw.readInt16LE(235),
      tickCurrent: raw.readInt32LE(269),
    };
  } catch {
    return null;
  }
}
