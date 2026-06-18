import {
  Token,
  TokenStandard,
  TOKEN_STANDARD_TO_PROTOCOL,
  type MultiProtocolProvider,
} from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { logger } from '../../../../utils/logger';
import type { UiToken } from '../tokens/types';
import { getTokenKey } from '../tokens/utils';

export async function fetchStarknetChainBalances(
  multiProvider: MultiProtocolProvider,
  tokens: UiToken[],
  userAddress: string,
): Promise<Record<string, bigint>> {
  const out: Record<string, bigint> = {};
  await Promise.all(
    tokens.map(async (token) => {
      try {
        out[getTokenKey(token)] = await readStarknetTokenBalance(multiProvider, {
          chainName: token.chainName,
          tokenAddress: token.address,
          isNative: token.isNative,
          owner: userAddress,
          standard: token.standard,
          decimals: token.decimals,
          symbol: token.symbol,
          name: token.name,
          coinGeckoId: token.coinGeckoId,
          logoURI: token.logoURI,
        });
      } catch (err) {
        logger.warn(`Starknet balance read failed for ${token.symbol}`, err as Error);
      }
    }),
  );
  return out;
}

export async function readStarknetTokenBalance(
  multiProvider: MultiProtocolProvider,
  args: {
    chainName: string;
    tokenAddress: string;
    isNative: boolean;
    owner: string;
    standard?: string;
    decimals?: number;
    symbol?: string;
    name?: string;
    coinGeckoId?: string;
    logoURI?: string;
  },
): Promise<bigint> {
  const token = new Token({
    chainName: args.chainName,
    standard: resolveStarknetStandard(args),
    addressOrDenom: args.tokenAddress,
    decimals: args.decimals ?? 18,
    symbol: args.symbol ?? '',
    name: args.name ?? args.symbol ?? '',
    coinGeckoId: args.coinGeckoId,
    logoURI: args.logoURI,
  });
  return (await token.getBalance(multiProvider, args.owner)).amount;
}

export function resolveStarknetStandard(args: {
  standard?: string;
  isNative: boolean;
}): TokenStandard {
  if (args.standard && isStarknetStandard(args.standard)) {
    return args.standard as TokenStandard;
  }
  return args.isNative ? TokenStandard.StarknetNative : TokenStandard.StarknetHypSynthetic;
}

function isStarknetStandard(standard: string): boolean {
  return (
    standard in TokenStandard &&
    TOKEN_STANDARD_TO_PROTOCOL[standard as TokenStandard] === ProtocolType.Starknet
  );
}
