import {
  AccountLayout,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';

import { logger } from '../../../utils/logger';
import type { UiToken } from '../tokens/types';
import { getTokenKey } from '../tokens/utils';

export async function fetchSolanaChainBalances(
  tokens: UiToken[],
  rpcUrl: string,
  ownerAddress: string,
): Promise<Record<string, bigint>> {
  let owner: PublicKey;
  try {
    owner = new PublicKey(ownerAddress);
  } catch {
    logger.warn(`Invalid Solana address: ${ownerAddress}`);
    return {};
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  const out: Record<string, bigint> = {};
  const splTokens = tokens.filter((t) => !t.isNative);
  const nativeTokens = tokens.filter((t) => t.isNative);

  if (splTokens.length > 0) {
    // Compute ATAs deterministically (no RPC). Try both token programs per
    // mint since UiToken doesn't carry the program ID.
    const entries: { tokenKey: string; ata: PublicKey }[] = [];
    for (const t of splTokens) {
      let mint: PublicKey;
      try {
        mint = new PublicKey(t.address);
      } catch {
        continue;
      }
      for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
        try {
          const ata = getAssociatedTokenAddressSync(mint, owner, false, programId);
          entries.push({ tokenKey: getTokenKey(t), ata });
        } catch {
          continue;
        }
      }
    }

    if (entries.length > 0) {
      // Solana RPC caps getMultipleAccounts at 100 per call.
      const BATCH_SIZE = 100;
      for (let start = 0; start < entries.length; start += BATCH_SIZE) {
        const batch = entries.slice(start, start + BATCH_SIZE);
        try {
          const infos = await connection.getMultipleAccountsInfo(batch.map((e) => e.ata));
          for (let i = 0; i < batch.length; i++) {
            const info = infos[i];
            if (!info?.data) continue;
            try {
              const { amount } = AccountLayout.decode(info.data);
              const { tokenKey } = batch[i];
              out[tokenKey] = (out[tokenKey] ?? 0n) + amount;
            } catch {
              // malformed account data, skip
            }
          }
        } catch (err) {
          logger.warn('Solana token balance batch fetch failed', err);
        }
      }
    }
  }

  if (nativeTokens.length > 0) {
    try {
      const lamports = await connection.getBalance(owner);
      const balance = BigInt(lamports);
      for (const t of nativeTokens) out[getTokenKey(t)] = balance;
    } catch (err) {
      logger.warn('Native SOL balance fetch failed', err);
    }
  }

  return out;
}
