import { Token, TokenStandard, type MultiProtocolProvider } from '@hyperlane-xyz/sdk';

import { logger } from '../../../../utils/logger';
import type { UiToken } from '../tokens/types';
import { getTokenKey } from '../tokens/utils';

interface AleoBalanceArgs {
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
}

export async function fetchAleoChainBalances(
  multiProvider: MultiProtocolProvider,
  tokens: UiToken[],
  userAddress: string,
): Promise<Record<string, bigint>> {
  const out: Record<string, bigint> = {};
  await Promise.all(
    tokens.map(async (token) => {
      try {
        out[getTokenKey(token)] = await readAleoTokenBalance(multiProvider, {
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
        logger.warn(`Aleo balance read failed for ${token.symbol}`, err as Error);
      }
    }),
  );
  return out;
}

export async function readAleoTokenBalance(
  multiProvider: MultiProtocolProvider,
  args: AleoBalanceArgs,
): Promise<bigint> {
  const directDenom = directAleoBalanceDenom(args);
  if (directDenom) {
    const provider = multiProvider.getProvider(args.chainName).provider as {
      getBalance(input: { address: string; denom: string }): Promise<bigint>;
    };
    return provider.getBalance({ address: args.owner, denom: directDenom });
  }

  const token = new Token({
    chainName: args.chainName,
    standard: resolveAleoBalanceStandard(args),
    addressOrDenom: args.tokenAddress,
    decimals: args.decimals ?? 18,
    symbol: args.symbol ?? '',
    name: args.name ?? args.symbol ?? '',
    coinGeckoId: args.coinGeckoId,
    logoURI: args.logoURI,
  });
  return (await token.getBalance(multiProvider, args.owner)).amount;
}

export function resolveAleoBalanceStandard(args: {
  tokenAddress: string;
  isNative: boolean;
  standard?: string;
}): TokenStandard {
  if (args.standard === TokenStandard.AleoHypNative) return TokenStandard.AleoHypNative;
  if (args.standard === TokenStandard.AleoHypCollateral && isAleoTokenProgram(args.tokenAddress))
    return TokenStandard.AleoHypCollateral;
  if (args.standard === TokenStandard.AleoHypSynthetic) return TokenStandard.AleoHypSynthetic;
  if (args.isNative) return TokenStandard.AleoNative;
  return TokenStandard.AleoHypSynthetic;
}

export function directAleoBalanceDenom(args: {
  tokenAddress: string;
  isNative: boolean;
  standard?: string;
}): string | null {
  if (args.standard === TokenStandard.AleoHypCollateral && !isAleoTokenProgram(args.tokenAddress)) {
    return args.tokenAddress;
  }
  return null;
}

export function isAleoTokenProgram(address: string): boolean {
  return address.includes('.aleo/');
}
