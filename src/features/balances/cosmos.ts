import { StargateClient } from '@cosmjs/stargate';
import { Token, TokenStandard, type MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { isZeroishAddress } from '@hyperlane-xyz/utils';

import { logger } from '../../utils/logger';
import type { BalanceToken } from './types';
import { getBalanceTokenKey } from './types';
import { getNativeTokenDenom } from './utils';

interface CosmosBalanceArgs {
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

export async function fetchCosmosChainBalances(
  multiProvider: MultiProtocolProvider,
  tokens: BalanceToken[],
  userAddress: string,
): Promise<Record<string, bigint>> {
  const out: Record<string, bigint> = {};
  if (tokens.length === 0) return out;

  const chainName = tokens[0]?.chainName;
  const nativeDenom = getNativeTokenDenom(multiProvider, chainName);
  const rpcUrl = rpcUrlFor(multiProvider, chainName);
  const bankTokens = tokens
    .map((token) => ({ token, denom: cosmosBankDenomForToken(token, nativeDenom) }))
    .filter((entry): entry is { token: BalanceToken; denom: string } => !!entry.denom);

  if (rpcUrl && bankTokens.length > 0) {
    const client = await StargateClient.connect(rpcUrl);
    try {
      const balances = await client.getAllBalances(userAddress);
      const byDenom = new Map(balances.map((balance) => [balance.denom, BigInt(balance.amount)]));
      for (const { token, denom } of bankTokens)
        out[getBalanceTokenKey(token)] = byDenom.get(denom) ?? 0n;
    } catch (err) {
      logger.warn(`Cosmos bank balance read failed for ${chainName}`, err as Error);
    } finally {
      client.disconnect();
    }
  }

  await Promise.all(
    tokens
      .filter((token) => !cosmosBankDenomForToken(token, nativeDenom))
      .map(async (token) => {
        try {
          out[getBalanceTokenKey(token)] = await readCosmosTokenBalance(multiProvider, {
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
          logger.warn(`Cosmos adapter balance read failed for ${token.symbol}`, err as Error);
        }
      }),
  );

  return out;
}

export async function readCosmosTokenBalance(
  multiProvider: MultiProtocolProvider,
  args: CosmosBalanceArgs,
): Promise<bigint> {
  const denom = cosmosBankDenomForToken(
    {
      address: args.tokenAddress,
      isNative: args.isNative,
      standard: args.standard,
    },
    getNativeTokenDenom(multiProvider, args.chainName),
  );
  if (denom) {
    const rpcUrl = rpcUrlFor(multiProvider, args.chainName);
    if (!rpcUrl) return 0n;
    const client = await StargateClient.connect(rpcUrl);
    try {
      const balance = await client.getBalance(args.owner, denom);
      return BigInt(balance.amount);
    } finally {
      client.disconnect();
    }
  }

  const token = new Token({
    chainName: args.chainName,
    standard: resolveCosmosBalanceStandard(args.standard),
    addressOrDenom: args.tokenAddress,
    decimals: args.decimals ?? 18,
    symbol: args.symbol ?? '',
    name: args.name ?? args.symbol ?? '',
    coinGeckoId: args.coinGeckoId,
    logoURI: args.logoURI,
  });
  return (await token.getBalance(multiProvider, args.owner)).amount;
}

export function cosmosBankDenomForToken(
  token: {
    address: string;
    isNative?: boolean;
    standard?: string;
  },
  nativeDenom?: string,
): string | null {
  if (token.standard === TokenStandard.CwHypNative) return null;
  if (token.standard === TokenStandard.CwHypSynthetic) return null;
  if (token.isNative && isZeroishAddress(token.address)) return nativeDenom ?? null;
  if (
    token.standard === TokenStandard.CosmNativeHypCollateral &&
    isCosmosModuleTokenId(token.address)
  ) {
    return null;
  }
  if (token.standard === TokenStandard.CosmNativeHypSynthetic) {
    return `hyperlane/${token.address}`;
  }
  return token.address;
}

export function resolveCosmosBalanceStandard(standard?: string): TokenStandard {
  if (standard === TokenStandard.CwHypNative) return TokenStandard.CwHypNative;
  if (standard === TokenStandard.CwHypSynthetic) return TokenStandard.CwHypSynthetic;
  if (standard === TokenStandard.CosmNativeHypCollateral) {
    return TokenStandard.CosmNativeHypCollateral;
  }
  return TokenStandard.CosmosNative;
}

function isCosmosModuleTokenId(address: string): boolean {
  return /^0x[0-9a-f]+$/i.test(address);
}

function rpcUrlFor(
  multiProvider: MultiProtocolProvider,
  chainName: string | undefined,
): string | undefined {
  if (!chainName) return undefined;
  return multiProvider.tryGetChainMetadata(chainName)?.rpcUrls?.[0]?.http;
}
