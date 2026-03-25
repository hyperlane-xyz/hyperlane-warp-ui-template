import {
  chainAddresses,
  chainMetadata,
  GithubRegistry,
  IRegistry,
  PartialRegistry,
} from '@hyperlane-xyz/registry';
import type { ChainMetadata } from '@hyperlane-xyz/sdk/metadata/chainMetadataTypes';
import type { ConfiguredMultiProtocolProvider as MultiProtocolProvider } from '@hyperlane-xyz/sdk/providers/ConfiguredMultiProtocolProvider';
import type { Token } from '@hyperlane-xyz/sdk/token/Token';
import type { ChainMap, ChainName } from '@hyperlane-xyz/sdk/types';
import type { WarpCoreConfig } from '@hyperlane-xyz/sdk/warp/types';
import type { WarpCore } from '@hyperlane-xyz/sdk/warp/WarpCore';
import {
  type KnownProtocolType,
  normalizeAddress,
  objFilter,
  ProtocolType,
} from '@hyperlane-xyz/utils';
import { toast } from 'react-toastify';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { config } from '../consts/config';
import { logger } from '../utils/logger';
import { assembleChainMetadata } from './chains/metadata';
import { getSdkRuntime } from './hyperlane/sdkRuntime';
import { TokenChainMap } from './tokens/types';
import {
  assembleTokensBySymbolChainMap,
  buildTokensArray,
  getTokenKey,
  groupTokensByCollateral,
  setResolvedUnderlyingMap,
} from './tokens/utils';
import { resolveWrappedCollateralTokens } from './tokens/wrappedTokenResolver';
import { FinalTransferStatuses, TransferContext, TransferStatus } from './transfer/types';
import { assembleWarpCoreConfig } from './warpCore/warpCoreConfig';

// Increment this when persist state has breaking changes
const PERSIST_STATE_VERSION = 2;

// Info stored per router address
export interface RouterAddressInfo {
  // Max decimals across all tokens in the warp route (for amount formatting)
  wireDecimals: number;
}

interface WarpContext {
  isWarpContextReady: boolean;
  registry: IRegistry;
  chainMetadata: ChainMap<ChainMetadata>;
  multiProvider: MultiProtocolProvider | undefined;
  warpCore: WarpCore | undefined;
  tokensBySymbolChainMap: Record<string, TokenChainMap>;
  /** Unified tokens array (deduplicated, can be origin or destination) */
  tokens: Token[];
  /** Pre-computed collateral groups for fast route checking */
  collateralGroups: Map<string, Token[]>;
  /** Pre-computed token key to Token map for O(1) lookups */
  tokenByKeyMap: Map<string, Token>;
  // Map of chain -> address -> router info
  routerAddressesByChainMap: Record<ChainName, Record<string, RouterAddressInfo>>;
  // Deduplicated, sorted CoinGecko IDs for all tokens
  coinGeckoIds: string[];
}

// Keeping everything here for now as state is simple
// Will refactor into slices as necessary
export interface AppState {
  // Chains and providers
  chainMetadata: ChainMap<ChainMetadata>;
  // Overrides to chain metadata set by user via the chain picker
  chainMetadataOverrides: ChainMap<Partial<ChainMetadata>>;
  setChainMetadataOverrides: (overrides?: ChainMap<Partial<ChainMetadata> | undefined>) => void;
  // Overrides to warp core configs added by user
  warpCoreConfigOverrides: WarpCoreConfig[];
  setWarpCoreConfigOverrides: (overrides?: WarpCoreConfig[] | undefined) => void;
  isWarpContextReady: boolean;
  multiProvider: MultiProtocolProvider | undefined;
  registry: IRegistry;
  warpCore: WarpCore | undefined;
  setWarpContext: (context: WarpContext) => void;

  // User history
  transfers: TransferContext[];
  addTransfer: (t: TransferContext) => void;
  resetTransfers: () => void;
  updateTransferStatus: (
    i: number,
    s: TransferStatus,
    options?: {
      msgId?: string;
      originTxHash?: string;
      originBlockNumber?: number;
      destinationTxHash?: string;
    },
  ) => void;
  failUnconfirmedTransfers: () => void;

  // Shared component state
  transferLoading: boolean;
  setTransferLoading: (isLoading: boolean) => void;
  isSideBarOpen: boolean;
  setIsSideBarOpen: (isOpen: boolean) => void;
  showEnvSelectModal: boolean;
  setShowEnvSelectModal: (show: boolean) => void;

  originChainName: ChainName;
  setOriginChainName: (originChainName: ChainName) => void;
  // instead of moving the TipCard component inside the formik and an useEffect can be set to watch for it
  isTipCardActionTriggered: boolean;
  setIsTipCardActionTriggered: (isTipCardActionTriggered: boolean) => void;
  /** Unified tokens array (deduplicated, can be origin or destination) */
  tokens: Token[];
  /** Pre-computed collateral groups for fast route checking */
  collateralGroups: Map<string, Token[]>;
  /** Pre-computed token key to Token map for O(1) lookups */
  tokenByKeyMap: Map<string, Token>;
  // Map of chain -> address -> router info
  // Used to: 1) prevent sending to warp route addresses, 2) format amounts with correct decimals
  routerAddressesByChainMap: Record<ChainName, Record<string, RouterAddressInfo>>;
  // Deduplicated, sorted CoinGecko IDs for all tokens (used by useTokenPrices)
  coinGeckoIds: string[];
}

export const useStore = create<AppState>()(
  persist(
    // Store reducers
    (set, get) => ({
      // Chains and providers
      chainMetadata: {},
      chainMetadataOverrides: {},
      isWarpContextReady: false,
      setChainMetadataOverrides: async (
        overrides: ChainMap<Partial<ChainMetadata> | undefined> = {},
      ) => {
        logger.debug('Setting chain overrides in store');
        const filtered = objFilter(overrides, (_, metadata) => !!metadata);
        const {
          isWarpContextReady,
          multiProvider,
          warpCore,
          routerAddressesByChainMap,
          tokens,
          collateralGroups,
          tokenByKeyMap,
          coinGeckoIds,
        } = await initWarpContext({
          ...get(),
          chainMetadataOverrides: filtered,
        });
        set({
          chainMetadataOverrides: filtered,
          isWarpContextReady,
          multiProvider,
          warpCore,
          routerAddressesByChainMap,
          tokens,
          collateralGroups,
          tokenByKeyMap,
          coinGeckoIds,
        });
      },
      warpCoreConfigOverrides: [],
      setWarpCoreConfigOverrides: async (overrides: WarpCoreConfig[] | undefined = []) => {
        logger.debug('Setting warp core config overrides in store');
        const {
          isWarpContextReady,
          multiProvider,
          warpCore,
          routerAddressesByChainMap,
          tokens,
          collateralGroups,
          tokenByKeyMap,
          coinGeckoIds,
        } = await initWarpContext({
          ...get(),
          warpCoreConfigOverrides: overrides,
        });
        set({
          warpCoreConfigOverrides: overrides,
          isWarpContextReady,
          multiProvider,
          warpCore,
          routerAddressesByChainMap,
          tokens,
          collateralGroups,
          tokenByKeyMap,
          coinGeckoIds,
        });
      },
      multiProvider: undefined,
      registry: new GithubRegistry({
        uri: config.registryUrl,
        branch: config.registryBranch,
        proxyUrl: config.registryProxyUrl,
      }),
      warpCore: undefined,
      setWarpContext: (context) => {
        logger.debug('Setting warp context in store');
        set(context);
      },

      // User history
      transfers: [],
      addTransfer: (t) => {
        set((state) => ({ transfers: [...state.transfers, t] }));
      },
      resetTransfers: () => {
        set(() => ({ transfers: [] }));
      },
      updateTransferStatus: (i, s, options) => {
        set((state) => {
          if (i >= state.transfers.length) return state;
          const txs = [...state.transfers];
          txs[i].status = s;
          txs[i].msgId ||= options?.msgId;
          txs[i].originTxHash ||= options?.originTxHash;
          txs[i].originBlockNumber ||= options?.originBlockNumber;
          txs[i].destinationTxHash ||= options?.destinationTxHash;
          return {
            transfers: txs,
          };
        });
      },
      failUnconfirmedTransfers: () => {
        set((state) => ({
          transfers: state.transfers.map((t) =>
            FinalTransferStatuses.includes(t.status) ? t : { ...t, status: TransferStatus.Failed },
          ),
        }));
      },

      // Shared component state
      transferLoading: false,
      setTransferLoading: (isLoading) => {
        set(() => ({ transferLoading: isLoading }));
      },
      isSideBarOpen: false,
      setIsSideBarOpen: (isSideBarOpen) => {
        set(() => ({ isSideBarOpen }));
      },
      showEnvSelectModal: false,
      setShowEnvSelectModal: (showEnvSelectModal) => {
        set(() => ({ showEnvSelectModal }));
      },
      originChainName: '',
      setOriginChainName: (originChainName: ChainName) => {
        set(() => ({ originChainName }));
      },
      routerAddressesByChainMap: {},
      isTipCardActionTriggered: false,
      setIsTipCardActionTriggered: (isTipCardActionTriggered: boolean) => {
        set(() => ({ isTipCardActionTriggered }));
      },
      tokens: [],
      collateralGroups: new Map(),
      tokenByKeyMap: new Map(),
      coinGeckoIds: [],
    }),

    // Store config
    {
      name: 'app-state', // name in storage
      partialize: (state) => ({
        // fields to persist
        chainMetadataOverrides: state.chainMetadataOverrides,
        transfers: state.transfers, // Keep for transfers through non-indexed routes
      }),
      version: PERSIST_STATE_VERSION,
      onRehydrateStorage: () => {
        logger.debug('Rehydrating state');
        return (state, error) => {
          state?.failUnconfirmedTransfers();
          if (error || !state) {
            logger.error('Error during hydration', error);
            return;
          }
          initWarpContext(state).then((context) => {
            state.setWarpContext(context);
            logger.debug('Rehydration complete');
          });
        };
      },
    },
  ),
);

async function initWarpContext({
  registry,
  chainMetadataOverrides,
  warpCoreConfigOverrides,
}: {
  registry: IRegistry;
  chainMetadataOverrides: ChainMap<Partial<ChainMetadata> | undefined>;
  warpCoreConfigOverrides: WarpCoreConfig[];
}): Promise<WarpContext> {
  let currentRegistry = registry;
  try {
    // Pre-load registry content to avoid repeated requests
    await currentRegistry.listRegistryContent();
  } catch (error) {
    currentRegistry = new PartialRegistry({
      chainAddresses: chainAddresses,
      chainMetadata: chainMetadata,
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

    // Resolve underlying addresses for lockbox/vault tokens so they group
    // with their non-wrapper counterparts (e.g., lockbox USDT = regular USDT)
    const resolvedMap = await resolveWrappedCollateralTokens(warpCore.tokens, multiProvider);
    setResolvedUnderlyingMap(resolvedMap);

    // Build unified tokens array (deduplicated by collateral at startup)
    const tokens = buildTokensArray(warpCore.tokens);
    // Build collateral groups for fast route checking
    const collateralGroups = groupTokensByCollateral(warpCore.tokens);
    // Build token by key map for O(1) lookups
    const tokenByKeyMap = new Map<string, Token>();
    for (const token of tokens) {
      tokenByKeyMap.set(getTokenKey(token), token);
    }

    const routerAddressesByChainMap = getRouterAddressesByChain(warpCore.tokens, wireDecimalsMap);
    const coinGeckoIds = Array.from(
      new Set(coreConfig.tokens.map((t) => t.coinGeckoId).filter(Boolean)),
    ).sort() as string[];
    return {
      isWarpContextReady: true,
      registry: currentRegistry,
      chainMetadata,
      multiProvider,
      warpCore,
      routerAddressesByChainMap,
      tokens,
      collateralGroups,
      tokenByKeyMap,
      coinGeckoIds,
    };
  } catch (error) {
    toast.error('Error initializing warp context. Please check connection status and configs.');
    logger.error('Error initializing warp context', error);
    return {
      isWarpContextReady: false,
      registry,
      chainMetadata: {},
      multiProvider: undefined,
      warpCore: undefined,
      tokensBySymbolChainMap: {},
      routerAddressesByChainMap: {},
      tokens: [],
      collateralGroups: new Map(),
      tokenByKeyMap: new Map(),
      coinGeckoIds: [],
    };
  }
}

// Build map of chain -> address -> router info using precomputed wireDecimals
function getRouterAddressesByChain(
  tokens: WarpCore['tokens'],
  wireDecimalsMap: Record<ChainName, Record<string, number>>,
): Record<ChainName, Record<string, RouterAddressInfo>> {
  return tokens.reduce<Record<ChainName, Record<string, RouterAddressInfo>>>((acc, token) => {
    if (!token.addressOrDenom) return acc;
    const normalizedAddr = normalizeAddress(token.addressOrDenom);

    // Use precomputed wireDecimals from config, fallback to token decimals
    const wireDecimals = wireDecimalsMap[token.chainName]?.[normalizedAddr] ?? token.decimals;

    acc[token.chainName] ||= {};
    acc[token.chainName][normalizedAddr] = { wireDecimals };
    return acc;
  }, {});
}
