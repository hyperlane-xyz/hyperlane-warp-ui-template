import { TokenStandard, type MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import {
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';

import { logger } from '../../utils/logger';
import type { BalanceToken } from './types';
import { getBalanceTokenKey } from './types';

const ZERO_ADDRESS = /^0x0+$/i;

export async function fetchSealevelChainBalances(
  rpcUrl: string,
  tokens: BalanceToken[],
  owner: string,
): Promise<Record<string, bigint>> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const ownerKey = new PublicKey(owner);
  const balances: Record<string, bigint> = {};
  const nativeTokens: BalanceToken[] = [];
  const splEntries: Array<{ token: BalanceToken; ata: PublicKey }> = [];

  for (const token of tokens) {
    if (isSealevelNativeBalance(token)) {
      nativeTokens.push(token);
      continue;
    }
    let mint: PublicKey;
    try {
      mint = new PublicKey(token.address);
    } catch {
      continue;
    }
    for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
      try {
        splEntries.push({
          token,
          ata: getAssociatedTokenAddressSync(
            mint,
            ownerKey,
            true,
            programId,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        });
      } catch {
        // Try the next token program.
      }
    }
  }

  await Promise.all([
    fillSplBalances(connection, balances, splEntries),
    fillNativeBalances(connection, balances, ownerKey, nativeTokens),
  ]);

  return balances;
}

export async function readSealevelTokenBalance(
  multiProvider: MultiProtocolProvider,
  args: {
    chainName: string;
    tokenAddress: string;
    isNative: boolean;
    owner: string;
    standard?: string;
  },
): Promise<bigint> {
  const rpcUrl = multiProvider.tryGetChainMetadata(args.chainName)?.rpcUrls?.[0]?.http;
  if (!rpcUrl) throw new Error(`Missing Sealevel RPC URL for ${args.chainName}`);
  const connection = new Connection(rpcUrl, 'confirmed');
  const ownerKey = new PublicKey(args.owner);
  if (
    isSealevelNativeBalance({
      address: args.tokenAddress,
      isNative: args.isNative,
      standard: args.standard,
    })
  ) {
    return BigInt(await connection.getBalance(ownerKey));
  }
  return fetchSplBalance(connection, ownerKey, args.tokenAddress);
}

export function isSealevelNativeBalance(token: {
  address: string;
  isNative: boolean;
  standard?: string;
}): boolean {
  return (
    token.isNative ||
    ZERO_ADDRESS.test(token.address) ||
    token.standard === TokenStandard.SealevelHypNative
  );
}

async function fetchSplBalance(
  connection: Connection,
  owner: PublicKey,
  mintAddress: string,
): Promise<bigint> {
  const mint = new PublicKey(mintAddress);
  let unexpectedError: unknown;
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      const ata = await getAssociatedTokenAddress(
        mint,
        owner,
        true,
        programId,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      const { value } = await connection.getTokenAccountBalance(ata);
      return BigInt(value.amount);
    } catch (err) {
      if (isMissingTokenAccountError(err)) continue;
      unexpectedError ??= err;
    }
  }
  if (unexpectedError) throw unexpectedError;
  return 0n;
}

async function fillSplBalances(
  connection: Connection,
  balances: Record<string, bigint>,
  entries: Array<{ token: BalanceToken; ata: PublicKey }>,
) {
  const batchSize = 100;
  for (let start = 0; start < entries.length; start += batchSize) {
    const batch = entries.slice(start, start + batchSize);
    let infos: Awaited<ReturnType<Connection['getMultipleAccountsInfo']>>;
    try {
      infos = await connection.getMultipleAccountsInfo(batch.map((entry) => entry.ata));
    } catch (err) {
      logger.warn('SPL balance batch read failed', err as Error);
      continue;
    }
    for (let i = 0; i < batch.length; i++) {
      const info = infos[i];
      if (!info?.data) continue;
      if (!isSplTokenAccount(info.owner, info.data.length)) continue;
      let amount: bigint;
      try {
        amount = AccountLayout.decode(info.data).amount;
      } catch (err) {
        logger.warn('SPL token account decode failed', err as Error);
        continue;
      }
      const key = getBalanceTokenKey(batch[i].token);
      balances[key] = (balances[key] ?? 0n) + amount;
    }
  }
}

function isSplTokenAccount(owner: PublicKey, dataLength: number): boolean {
  return (
    dataLength >= AccountLayout.span &&
    (owner.equals(TOKEN_PROGRAM_ID) || owner.equals(TOKEN_2022_PROGRAM_ID))
  );
}

function isMissingTokenAccountError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /could not find account|Account does not exist/i.test(message);
}

async function fillNativeBalances(
  connection: Connection,
  balances: Record<string, bigint>,
  owner: PublicKey,
  tokens: BalanceToken[],
) {
  if (!tokens.length) return;
  const balance = BigInt(await connection.getBalance(owner));
  for (const token of tokens) balances[getBalanceTokenKey(token)] = balance;
}
