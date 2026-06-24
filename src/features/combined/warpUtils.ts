import type { MultiProtocolProvider, Token } from '@hyperlane-xyz/sdk';
import { TokenStandard } from '@hyperlane-xyz/sdk';

import { getTokenKey } from '../tokens/utils';
import type { CombinedToken } from './types';

// Standards that represent a chain's native gas token bridged via Hyperlane.
// These tokens use the Hyperlane router contract address as addressOrDenom,
// NOT the canonical native token address (e.g. 0x000...) that the engine uses.
const HYP_NATIVE_STANDARDS = new Set([
  TokenStandard.EvmHypNative,
  TokenStandard.SealevelHypNative,
  TokenStandard.CwHypNative,
  TokenStandard.StarknetHypNative,
  TokenStandard.AleoHypNative,
  TokenStandard.TronHypNative,
]);

export function isHypNativeStandard(standard: TokenStandard): boolean {
  return HYP_NATIVE_STANDARDS.has(standard);
}

// Convert a WarpCore Token to a CombinedToken for display in the merged picker.
// Returns null if the chain cannot be resolved (e.g., no chainId in metadata).
export function warpTokenToCombined(
  token: Token,
  multiProvider: MultiProtocolProvider,
): CombinedToken | null {
  const chainMeta = multiProvider.tryGetChainMetadata(token.chainName);
  if (!chainMeta) return null;

  // Prefer chainId; fall back to domainId for non-EVM chains (Solana, Cosmos, Radix, Aleo).
  const rawId = chainMeta.chainId ?? (chainMeta as any).domainId;
  if (rawId == null) return null;
  const chainId = Number(rawId);

  // HypNative tokens bridge the native gas token of a chain. Mark isNative=true
  // so the merge logic can match them with the engine's native token entry
  // (which uses a different address — the engine's zero/canonical address,
  // while WarpCore uses the router contract address).
  const isNative = token.standard === TokenStandard.EvmNative || isHypNativeStandard(token.standard);

  // For HypERC20Collateral and similar: addressOrDenom is the Hyperlane router contract,
  // but collateralAddressOrDenom is the actual underlying ERC-20 (e.g. USDC contract).
  // Use the underlying address so we match the engine's token entry by address key.
  const canonicalAddress =
    !isNative && token.collateralAddressOrDenom
      ? token.collateralAddressOrDenom
      : token.addressOrDenom;

  return {
    chainId,
    address: canonicalAddress,
    symbol: token.symbol,
    decimals: token.decimals,
    isNative,
    isBridgeToken: true,
    isPoolToken: false,
    canBridge: true,
    canSwap: false,
    bridgeSymbols: [],
    warpRouteIds: [],
    chainName: token.chainName,
    name: token.name ?? token.symbol,
    addressOrDenom: token.addressOrDenom,
    coinGeckoId: token.coinGeckoId,
    logoURI: token.logoURI,
    warpCoreKey: getTokenKey(token),
  };
}
