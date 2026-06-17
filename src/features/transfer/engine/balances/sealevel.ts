import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';

import type { UiToken } from '../tokens/types';
import { getTokenKey } from '../tokens/utils';

const ZERO_ADDRESS = /^0x0+$/i;

export async function fetchSealevelChainBalances(
  rpcUrl: string,
  tokens: UiToken[],
  owner: string,
): Promise<Record<string, bigint>> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const ownerKey = new PublicKey(owner);
  const balances: Record<string, bigint> = {};

  for (const token of tokens) {
    const key = getTokenKey(token);
    if (token.isNative || ZERO_ADDRESS.test(token.address)) {
      balances[key] = BigInt(await connection.getBalance(ownerKey));
      continue;
    }
    balances[key] = await fetchSplBalance(connection, ownerKey, token.address);
  }

  return balances;
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
