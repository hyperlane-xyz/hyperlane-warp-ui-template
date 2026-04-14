import type { ITokenMetadata } from '@hyperlane-xyz/sdk/token/ITokenMetadata';
import type { ChainName } from '@hyperlane-xyz/sdk/types';
import { normalizeAddress } from '@hyperlane-xyz/utils';

export interface RouterAddressInfo {
  // Max decimals across all tokens in the warp route (for amount formatting)
  wireDecimals: number;
}

export function getRouterAddressesByChain(
  tokens: ITokenMetadata[],
  wireDecimalsMap: Record<ChainName, Record<string, number>>,
): Record<ChainName, Record<string, RouterAddressInfo>> {
  return tokens.reduce<Record<ChainName, Record<string, RouterAddressInfo>>>((acc, token) => {
    if (!token.addressOrDenom) return acc;
    const normalizedAddr = normalizeAddress(token.addressOrDenom, token.protocol);
    const wireDecimals = wireDecimalsMap[token.chainName]?.[normalizedAddr] ?? token.decimals;

    acc[token.chainName] ||= {};
    acc[token.chainName][normalizedAddr] = { wireDecimals };
    return acc;
  }, {});
}
