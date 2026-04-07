import { StargateClient } from '@cosmjs/stargate';
import { Token, TokenStandard } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { logger } from '../../utils/logger';
import { getTokenKey } from '../tokens/utils';
import { TokenEntry } from './tokens';

export interface CosmosChainGroup {
  chainName: string;
  bankTokens: { key: string; denom: string }[];
  fallbackTokens: TokenEntry[];
}

/** Standards where the bank denom is `addressOrDenom`. */
const BANK_DENOM_FROM_ADDRESS: TokenStandard[] = [
  TokenStandard.CosmosNative,
  TokenStandard.CosmosIbc,
  TokenStandard.CosmosIcs20,
  TokenStandard.CWNative,
  TokenStandard.CW20,
  TokenStandard.CwHypSynthetic,
];

/** Standards where the bank denom is `collateralAddressOrDenom`. */
const BANK_DENOM_FROM_COLLATERAL: TokenStandard[] = [
  TokenStandard.CwHypCollateral,
  TokenStandard.CosmNativeHypCollateral,
];

function classifyCosmosToken(token: Token): { type: 'bank' | 'unknown'; denom?: string } {
  if (BANK_DENOM_FROM_ADDRESS.includes(token.standard)) {
    return { type: 'bank', denom: token.addressOrDenom };
  }
  if (BANK_DENOM_FROM_COLLATERAL.includes(token.standard)) {
    return token.collateralAddressOrDenom
      ? { type: 'bank', denom: token.collateralAddressOrDenom }
      : { type: 'unknown' };
  }
  if (token.standard === TokenStandard.CosmNativeHypSynthetic) {
    return { type: 'bank', denom: `hyperlane/${token.addressOrDenom}` };
  }
  // CwHypNative requires dynamic denom resolution via contract — SDK fallback
  return { type: 'unknown' };
}

/** Group Cosmos/CosmosNative tokens by chain, split into bank-batchable vs SDK fallback. */
export function groupCosmosTokensByChain(tokens: Token[]): Map<string, CosmosChainGroup> {
  const groups = new Map<string, CosmosChainGroup>();

  for (const token of tokens) {
    if (token.protocol !== ProtocolType.Cosmos && token.protocol !== ProtocolType.CosmosNative)
      continue;

    const key = getTokenKey(token);
    const { type, denom } = classifyCosmosToken(token);

    if (!groups.has(token.chainName)) {
      groups.set(token.chainName, {
        chainName: token.chainName,
        bankTokens: [],
        fallbackTokens: [],
      });
    }
    const group = groups.get(token.chainName)!;

    if (type === 'bank' && denom) {
      group.bankTokens.push({ key, denom });
    } else {
      group.fallbackTokens.push({ token, key });
    }
  }

  return groups;
}

/**
 * Fetch bank-module token balances for a single cosmos chain via getAllBalances.
 * Fallback tokens (e.g. CwHypNative) are handled by the caller via fetchSdkBalance.
 */
export async function fetchCosmosChainBalances(
  group: CosmosChainGroup,
  rpcUrl: string,
  address: string,
): Promise<Record<string, bigint>> {
  if (group.bankTokens.length === 0) return {};

  const client = await StargateClient.connect(rpcUrl);
  try {
    const allCoins = await client.getAllBalances(address);
    const coinMap = new Map(allCoins.map((c) => [c.denom, BigInt(c.amount)]));

    const out: Record<string, bigint> = {};
    for (const { key, denom } of group.bankTokens) {
      const balance = coinMap.get(denom);
      if (balance !== undefined) {
        out[key] = balance;
      }
    }
    return out;
  } catch (err) {
    logger.warn(`Bank allBalances failed on ${group.chainName}`, err);
    return {};
  } finally {
    client.disconnect();
  }
}
