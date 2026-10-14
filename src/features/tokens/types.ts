<<<<<<< HEAD
import { ChainMap, ChainMetadata, Token, TokenAmount } from '@hyperlane-xyz/sdk';

export type MultiCollateralTokenMap = Record<string, Record<string, Token[]>>;

export type TokenChainMap = {
  chains: ChainMap<{ token: Token; metadata: ChainMetadata | null }>;
  tokenInformation: Token;
};

export type Tokens = Array<{ token: Token; disabled: boolean }>;

export interface TokensWithDestinationBalance {
  originToken: Token;
  destinationToken: Token;
  balance: bigint;
}

export interface TokenWithFee {
  token: Token;
  tokenFee?: TokenAmount;
  balance: bigint;
=======
import type { TokenDiscovery } from '../api/types';

export type TokenSelectionMode = 'origin' | 'destination';

// UI-side token shape: engine TokenDiscovery + the chainName for display
// and `addressOrDenom` to satisfy TokenIcon's structural interface
// (matches warp-ui's IToken-shaped fields the picker actually uses).
export interface UiToken {
  // From engine TokenDiscovery
  chainId: number;
  address: string;
  symbol: string;
  standard?: string;
  decimals: number; // null in engine schema is normalised to 18 here
  isNative: boolean;
  wrappedAddress?: string;
  isBridgeToken: boolean;
  isPoolToken: boolean;
  canBridge: boolean;
  canSwap: boolean;
  bridgeSymbols: string[];
  warpRouteIds: string[];
  coinGeckoId?: string;

  // UI-derived
  chainName: string;
  name: string;
  addressOrDenom: string;
  // Engine may return an absolute URL or a registry-relative path; the
  // TokenIcon component normalises relative paths against links.imgPath.
  logoURI?: string;
}

export function tokenDiscoveryToUi(t: TokenDiscovery, chainName: string): UiToken {
  return {
    ...t,
    chainName,
    decimals: t.decimals ?? 18,
    name: t.name ?? t.symbol,
    addressOrDenom: t.address,
    logoURI: t.logoURI,
    coinGeckoId: t.coinGeckoId,
  };
>>>>>>> origin/main
}
