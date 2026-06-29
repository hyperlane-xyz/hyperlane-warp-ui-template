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
  if (!rpcUrl) return 0n;
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
    } catch {
      // Try the Token-2022 associated account if the classic SPL account is absent.
    }
  }
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
    const infos = await connection.getMultipleAccountsInfo(batch.map((entry) => entry.ata));
    for (let i = 0; i < batch.length; i++) {
      const info = infos[i];
      if (!info?.data) continue;
      const { amount } = AccountLayout.decode(info.data);
      const key = getBalanceTokenKey(batch[i].token);
      balances[key] = (balances[key] ?? 0n) + amount;
    }
  }
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
