import type { ChainMetadata } from '@hyperlane-xyz/sdk/metadata/chainMetadataTypes';
import type { Token } from '@hyperlane-xyz/sdk/token/Token';
import type { ChainMap, ChainName } from '@hyperlane-xyz/sdk/types';
import type { WarpCoreConfig } from '@hyperlane-xyz/sdk/warp/types';
import { type KnownProtocolType, normalizeAddress, ProtocolType } from '@hyperlane-xyz/utils';
import type { RouterAddressInfo } from './store';
import { getSdkRuntime } from './hyperlane/sdkRuntime';
import {
  assembleTokensBySymbolChainMap,
  buildTokensArray,
  getTokenKey,
  groupTokensByCollateral,
  setResolvedUnderlyingMap,
} from './tokens/utils';
import { resolveWrappedCollateralTokens } from './tokens/wrappedTokenResolver';
import type { WarpRuntimeContext } from './storeInit';

type InitWarpRuntimeArgs = {
  chainMetadataWithOverrides: ChainMap<ChainMetadata>;
  coreConfig: WarpCoreConfig;
  wireDecimalsMap: Record<ChainName, Record<string, number>>;
};

export async function initWarpRuntime({
  chainMetadataWithOverrides,
  coreConfig,
  wireDecimalsMap,
}: InitWarpRuntimeArgs): Promise<WarpRuntimeContext> {
  const protocols = Array.from(
    new Set(
      Object.values(chainMetadataWithOverrides)
        .map((metadata) => metadata.protocol)
        .filter((protocol): protocol is KnownProtocolType => protocol !== ProtocolType.Unknown),
    ),
  );

  const { createMultiProvider, WarpCore } = await getSdkRuntime(protocols);
  const multiProvider = createMultiProvider(chainMetadataWithOverrides);
  const warpCore = WarpCore.FromConfig(multiProvider, coreConfig);

  const tokensBySymbolChainMap = assembleTokensBySymbolChainMap(warpCore.tokens, multiProvider);
  const resolvedMap = await resolveWrappedCollateralTokens(warpCore.tokens, multiProvider);
  setResolvedUnderlyingMap(resolvedMap);

  const tokens = buildTokensArray(warpCore.tokens);
  const collateralGroups = groupTokensByCollateral(warpCore.tokens);
  const tokenByKeyMap = new Map<string, Token>();
  for (const token of tokens) {
    tokenByKeyMap.set(getTokenKey(token), token);
  }

  return {
    multiProvider,
    warpCore,
    tokensBySymbolChainMap,
    routerAddressesByChainMap: getRouterAddressesByChain(warpCore.tokens, wireDecimalsMap),
    tokens,
    collateralGroups,
    tokenByKeyMap,
  };
}

function getRouterAddressesByChain(
  tokens: Token[],
  wireDecimalsMap: Record<ChainName, Record<string, number>>,
): Record<ChainName, Record<string, RouterAddressInfo>> {
  return tokens.reduce<Record<ChainName, Record<string, RouterAddressInfo>>>((acc, token) => {
    if (!token.addressOrDenom) return acc;
    const normalizedAddr = normalizeAddress(token.addressOrDenom);
    const wireDecimals = wireDecimalsMap[token.chainName]?.[normalizedAddr] ?? token.decimals;

    acc[token.chainName] ||= {};
    acc[token.chainName][normalizedAddr] = { wireDecimals };
    return acc;
  }, {});
}
