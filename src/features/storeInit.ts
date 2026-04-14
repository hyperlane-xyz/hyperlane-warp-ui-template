import { chainAddresses, chainMetadata, IRegistry, PartialRegistry } from '@hyperlane-xyz/registry';
import type { ChainMetadata } from '@hyperlane-xyz/sdk/metadata/chainMetadataTypes';
import { MultiProviderAdapter } from '@hyperlane-xyz/sdk/providers/MultiProviderAdapter';
import type { Token } from '@hyperlane-xyz/sdk/token/Token';
import type { ChainMap } from '@hyperlane-xyz/sdk/types';
import type { WarpCoreConfig } from '@hyperlane-xyz/sdk/warp/types';
import { toast } from 'react-toastify';

import { logger } from '../utils/logger';
import { assembleChainMetadata } from './chains/metadata';
import { getRouterAddressesByChain } from './routerAddresses';
import type { AppState } from './store';
import { buildRouteTokens } from './tokens/routeTokens';
import { buildTokensArray, getTokenKey, groupTokensByCollateral } from './tokens/utils';
import { assembleWarpCoreConfig } from './warpCore/warpCoreConfig';

type InitWarpContextArgs = {
  registry: IRegistry;
  chainMetadataOverrides: ChainMap<Partial<ChainMetadata> | undefined>;
  warpCoreConfigOverrides: WarpCoreConfig[];
};

type WarpContext = Pick<
  AppState,
  | 'isWarpContextReady'
  | 'registry'
  | 'chainMetadata'
  | 'multiProvider'
  | 'warpCore'
  | 'routeTokens'
  | 'tokens'
  | 'collateralGroups'
  | 'tokenByKeyMap'
  | 'routerAddressesByChainMap'
  | 'coinGeckoIds'
>;

export type WarpRuntimeContext = Pick<
  AppState,
  | 'multiProvider'
  | 'warpCore'
  | 'routeTokens'
  | 'tokens'
  | 'collateralGroups'
  | 'tokenByKeyMap'
  | 'routerAddressesByChainMap'
> & {
  resolvedUnderlyingMap: Map<string, string>;
};

export type InitWarpContextResult = {
  context: WarpContext;
  loadRuntime: () => Promise<WarpRuntimeContext>;
};

export async function initWarpContext({
  registry,
  chainMetadataOverrides,
  warpCoreConfigOverrides,
}: InitWarpContextArgs): Promise<InitWarpContextResult> {
  let currentRegistry = registry;
  try {
    await currentRegistry.listRegistryContent();
  } catch (error) {
    currentRegistry = new PartialRegistry({
      chainAddresses,
      chainMetadata,
    });
    logger.warn(
      'Failed to list registry content using GithubRegistry, will continue with PartialRegistry.',
      error,
    );
  }

  try {
    const { config: coreConfig, wireDecimalsMap } = await assembleWarpCoreConfig(
      warpCoreConfigOverrides,
      currentRegistry,
    );

    const chainsInTokens = Array.from(new Set(coreConfig.tokens.map((t) => t.chainName)));
    const { chainMetadata, chainMetadataWithOverrides } = await assembleChainMetadata(
      chainsInTokens,
      currentRegistry,
      chainMetadataOverrides,
    );
    const multiProvider = new MultiProviderAdapter(chainMetadataWithOverrides);
    const routeTokens = buildRouteTokens(coreConfig) as unknown as Token[];
    const tokens = buildTokensArray(routeTokens);
    const collateralGroups = groupTokensByCollateral(routeTokens);
    const tokenByKeyMap = new Map<string, Token>();
    for (const token of tokens) {
      tokenByKeyMap.set(getTokenKey(token), token);
    }

    const routerAddressesByChainMap = getRouterAddressesByChain(routeTokens, wireDecimalsMap);
    const coinGeckoIds = Array.from(
      new Set(coreConfig.tokens.map((t) => t.coinGeckoId).filter(Boolean)),
    ).sort() as string[];

    return {
      context: {
        isWarpContextReady: true,
        registry: currentRegistry,
        chainMetadata,
        multiProvider,
        warpCore: undefined,
        routeTokens,
        routerAddressesByChainMap,
        tokens,
        collateralGroups,
        tokenByKeyMap,
        coinGeckoIds,
      },
      loadRuntime: async () => {
        const { initWarpRuntime } = await import('./storeRuntime');
        return initWarpRuntime({
          chainMetadataWithOverrides,
          coreConfig,
          wireDecimalsMap,
        });
      },
    };
  } catch (error) {
    toast.error('Error initializing warp context. Please check connection status and configs.');
    logger.error('Error initializing warp context', error);
    return {
      context: {
        isWarpContextReady: false,
        registry,
        chainMetadata: {},
        multiProvider: undefined,
        warpCore: undefined,
        routeTokens: [],
        routerAddressesByChainMap: {},
        tokens: [],
        collateralGroups: new Map(),
        tokenByKeyMap: new Map(),
        coinGeckoIds: [],
      },
      loadRuntime: async () => ({
        multiProvider: undefined,
        warpCore: undefined,
        routeTokens: [],
        routerAddressesByChainMap: {},
        tokens: [],
        collateralGroups: new Map(),
        tokenByKeyMap: new Map(),
        resolvedUnderlyingMap: new Map(),
      }),
    };
  }
}
