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

const SOLANA_ACCOUNT_BATCH_SIZE = 100;

export async function readSolanaTokenBalance({
  tokenAddress,
  isNative,
  rpcUrl,
  ownerAddress,
}: {
  tokenAddress: string;
  isNative: boolean;
  rpcUrl: string;
  ownerAddress: string;
}): Promise<bigint | null> {
  let owner: PublicKey;
  try {
    owner = new PublicKey(ownerAddress);
  } catch {
    logger.warn(`Invalid Solana address: ${ownerAddress}`);
    return null;
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  if (isNative) {
    return BigInt(await connection.getBalance(owner));
  }

  let mint: PublicKey;
  try {
    mint = new PublicKey(tokenAddress);
  } catch {
    return null;
  }

  let balance = 0n;
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      const associatedTokenAccount = getAssociatedTokenAddressSync(mint, owner, false, programId);
      const accountInfo = await connection.getAccountInfo(associatedTokenAccount);
      if (!accountInfo?.data) continue;
      const { amount } = AccountLayout.decode(accountInfo.data);
      balance += amount;
    } catch {
      // Try both SPL token programs; one side often does not exist.
    }
  }

  return balance;
}

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
  const balances: Record<string, bigint> = {};
  const splTokens = tokens.filter((token) => !token.isNative);
  const nativeTokens = tokens.filter((token) => token.isNative);

  const entries: Array<{ tokenKey: string; associatedTokenAccount: PublicKey }> = [];
  for (const token of splTokens) {
    let mint: PublicKey;
    try {
      mint = new PublicKey(token.address);
    } catch {
      continue;
    }

    for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
      try {
        entries.push({
          tokenKey: getTokenKey(token),
          associatedTokenAccount: getAssociatedTokenAddressSync(mint, owner, false, programId),
        });
      } catch {
        // Some engine token refs are not SPL mints for the current program.
      }
    }
  }

  for (let start = 0; start < entries.length; start += SOLANA_ACCOUNT_BATCH_SIZE) {
    const batch = entries.slice(start, start + SOLANA_ACCOUNT_BATCH_SIZE);
    try {
      const accountInfos = await connection.getMultipleAccountsInfo(
        batch.map((entry) => entry.associatedTokenAccount),
      );
      for (let index = 0; index < batch.length; index++) {
        const accountInfo = accountInfos[index];
        if (!accountInfo?.data) continue;
        try {
          const { amount } = AccountLayout.decode(accountInfo.data);
          const tokenKey = batch[index]!.tokenKey;
          balances[tokenKey] = (balances[tokenKey] ?? 0n) + amount;
        } catch {
          // Ignore malformed account data; another token program may still match.
        }
      }
    } catch (err) {
      logger.warn('Solana token balance batch fetch failed', err as Error);
    }
  }

  if (nativeTokens.length) {
    try {
      const balance = BigInt(await connection.getBalance(owner));
      for (const token of nativeTokens) {
        balances[getTokenKey(token)] = balance;
      }
    } catch (err) {
      logger.warn('Native SOL balance fetch failed', err as Error);
    }
  }

  return balances;
}
