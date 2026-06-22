import { Token, TokenStandard, type MultiProtocolProvider } from '@hyperlane-xyz/sdk';

import { logger } from '../../utils/logger';
import type { BalanceToken } from './types';
import { getBalanceTokenKey } from './types';

interface RadixBalanceArgs {
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

export async function fetchRadixChainBalances(
  multiProvider: MultiProtocolProvider,
  tokens: BalanceToken[],
  userAddress: string,
): Promise<Record<string, bigint>> {
  const out: Record<string, bigint> = {};
  await Promise.all(
    tokens.map(async (token) => {
      try {
        out[getBalanceTokenKey(token)] = await readRadixTokenBalance(multiProvider, {
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
        logger.warn(`Radix balance read failed for ${token.symbol}`, err as Error);
      }
    }),
  );
  return out;
}

export async function readRadixTokenBalance(
  multiProvider: MultiProtocolProvider,
  args: RadixBalanceArgs,
): Promise<bigint> {
  const token = new Token({
    chainName: args.chainName,
    standard: resolveRadixBalanceStandard(args),
    addressOrDenom: args.tokenAddress,
    decimals: args.decimals ?? 18,
    symbol: args.symbol ?? '',
    name: args.name ?? args.symbol ?? '',
    coinGeckoId: args.coinGeckoId,
    logoURI: args.logoURI,
  });
  return (await token.getBalance(multiProvider, args.owner)).amount;
}

export function resolveRadixBalanceStandard(args: {
  tokenAddress: string;
  isNative: boolean;
  standard?: string;
}): TokenStandard {
  if (args.isNative || isRadixResourceAddress(args.tokenAddress)) return TokenStandard.RadixNative;
  if (args.standard === TokenStandard.RadixHypCollateral) return TokenStandard.RadixHypCollateral;
  if (args.standard === TokenStandard.RadixHypSynthetic) return TokenStandard.RadixHypSynthetic;
  return TokenStandard.RadixHypSynthetic;
}

export function isRadixResourceAddress(address: string): boolean {
  return address.startsWith('resource_');
}
