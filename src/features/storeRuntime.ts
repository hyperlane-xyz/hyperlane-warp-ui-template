import type { ChainMetadata } from '@hyperlane-xyz/sdk/metadata/chainMetadataTypes';
import type { Token } from '@hyperlane-xyz/sdk/token/Token';
import type { ChainMap, ChainName } from '@hyperlane-xyz/sdk/types';
import type { WarpCoreConfig } from '@hyperlane-xyz/sdk/warp/types';
import { type KnownProtocolType, ProtocolType } from '@hyperlane-xyz/utils';

import { getSdkRuntime } from './hyperlane/sdkRuntime';
import { getRouterAddressesByChain } from './routerAddresses';
import type { WarpRuntimeContext } from './storeInit';
import { buildTokensArray, getTokenKey, groupTokensByCollateral } from './tokens/utils';
import { resolveWrappedCollateralTokens } from './tokens/wrappedTokenResolver';

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

  const { createMultiProvider, warpCore } = await getSdkRuntime(protocols);
  const multiProvider = createMultiProvider(chainMetadataWithOverrides);
  const runtimeWarpCore = warpCore.FromConfig(multiProvider, coreConfig);

  const resolvedMap = await resolveWrappedCollateralTokens(runtimeWarpCore.tokens, multiProvider);

  const tokens = buildTokensArray(runtimeWarpCore.tokens);
  const collateralGroups = groupTokensByCollateral(runtimeWarpCore.tokens);
  const tokenByKeyMap = new Map<string, Token>();
  for (const token of tokens) {
    tokenByKeyMap.set(getTokenKey(token), token);
  }

  return {
    multiProvider,
    warpCore: runtimeWarpCore,
    routeTokens: runtimeWarpCore.tokens,
    routerAddressesByChainMap: getRouterAddressesByChain(runtimeWarpCore.tokens, wireDecimalsMap),
    tokens,
    collateralGroups,
    tokenByKeyMap,
    resolvedUnderlyingMap: resolvedMap,
  };
}
