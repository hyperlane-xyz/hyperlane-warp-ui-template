import {
  ChainAddresses,
  GithubRegistry,
  IRegistry,
  PartialRegistry,
} from '@hyperlane-xyz/registry';
import {
  ChainMap,
  ChainMetadata,
  ChainName,
  MultiProtocolProvider,
  Token,
  WarpCore,
  WarpCoreConfig,
} from '@hyperlane-xyz/sdk';
import { normalizeAddress, objFilter } from '@hyperlane-xyz/utils';
import { toast } from 'react-toastify';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { config } from '../consts/config';
import { logger } from '../utils/logger';
import { assembleChainAddresses } from './chains/addresses';
import { assembleChainMetadata } from './chains/metadata';
import {
  buildTokensArray,
  getTokenKey,
  groupTokensByCollateral,
  setResolvedUnderlyingMap,
} from './tokens/utils';
import { resolveWrappedCollateralTokens } from './tokens/wrappedTokenResolver';
import { FinalTransferStatuses, TransferContext, TransferStatus } from './transfer/types';
import {
  type E2ETokenSnapshot,
  initE2EStateIfEnabled,
  markE2ERuntimeReady,
} from './wallet/_e2e/windowState';
import { assembleWarpCoreConfig } from './warpCore/warpCoreConfig';

// Increment this when persist state has breaking changes
const PERSIST_STATE_VERSION = 2;

interface WarpContext {
  registry: IRegistry;
  chainMetadata: ChainMap<ChainMetadata>;
  chainAddresses: ChainMap<ChainAddresses>;
  multiProvider: MultiProtocolProvider;
  warpCore: WarpCore;
  /** Unified tokens array (deduplicated, can be origin or destination) */
  tokens: Token[];
  /** Pre-computed collateral groups for fast route checking */
  collateralGroups: Map<string, Token[]>;
  /** Pre-computed token key to Token map for O(1) lookups */
  tokenByKeyMap: Map<string, Token>;
  // Set of router addresses per chain
  routerAddressesByChainMap: Record<ChainName, Set<string>>;
  // Deduplicated, sorted CoinGecko IDs for all tokens
  coinGeckoIds: string[];
}

function buildE2ETokenSnapshot(tokens: Token[] | undefined): E2ETokenSnapshot[] | undefined {
  if (!tokens?.length) return undefined;
  return tokens.map((t) => ({
    key: getTokenKey(t),
    chain: t.chainName,
    symbol: t.symbol,
    standard: t.standard,
    addressOrDenom: t.addressOrDenom,
    collateralAddressOrDenom: t.collateralAddressOrDenom,
    connectionKeys: (t.connections ?? []).map((c) => getTokenKey(c.token as Token)),
  }));
}
// Keeping everything here for now as state is simple
// Will refactor into slices as necessary
export interface AppState {
  // Chains and providers
  chainMetadata: ChainMap<ChainMetadata>;
  // Per-chain contract addresses, merged from registry + filesystem (addresses.yaml)
  chainAddresses: ChainMap<ChainAddresses>;
  // Overrides to chain metadata set by user via the chain picker
  chainMetadataOverrides: ChainMap<Partial<ChainMetadata>>;
  setChainMetadataOverrides: (overrides?: ChainMap<Partial<ChainMetadata> | undefined>) => void;
  // Overrides to warp core configs added by user
  warpCoreConfigOverrides: WarpCoreConfig[];
  setWarpCoreConfigOverrides: (overrides?: WarpCoreConfig[] | undefined) => void;
  multiProvider: MultiProtocolProvider;
  registry: IRegistry;
  warpCore: WarpCore;
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
  // Set of router addresses per chain — used to prevent sending to warp route
  // addresses and to filter message API results
  routerAddressesByChainMap: Record<ChainName, Set<string>>;
  // Deduplicated, sorted CoinGecko IDs for all tokens (used by useTokenPrices)
  coinGeckoIds: string[];
}

export const useStore = create<AppState>()(
  persist(
    // Store reducers
    (set, get) => ({
      // Chains and providers
      chainMetadata: {},
      chainAddresses: {},
      chainMetadataOverrides: {},
      setChainMetadataOverrides: async (
        overrides: ChainMap<Partial<ChainMetadata> | undefined> = {},
      ) => {
        logger.debug('Setting chain overrides in store');
        const filtered = objFilter(overrides, (_, metadata) => !!metadata);
        const {
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
          multiProvider,
          warpCore,
          routerAddressesByChainMap,
          tokens,
          collateralGroups,
          tokenByKeyMap,
          coinGeckoIds,
        });
      },
      multiProvider: new MultiProtocolProvider({}),
      registry: new GithubRegistry({
        uri: config.registryUrl,
        branch: config.registryBranch,
        proxyUrl: config.registryProxyUrl,
      }),
      warpCore: new WarpCore(new MultiProtocolProvider({}), []),
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
    // Lazy-load the published constants so they stay out of the initial bundle
    const { chainAddresses, chainMetadata } = await import('@hyperlane-xyz/registry');
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
    const { config: coreConfig } = await assembleWarpCoreConfig(
      warpCoreConfigOverrides,
      currentRegistry,
    );

    const chainsInTokens = Array.from(new Set(coreConfig.tokens.map((t) => t.chainName)));
    const [{ chainMetadata, chainMetadataWithOverrides }, chainAddresses] = await Promise.all([
      assembleChainMetadata(chainsInTokens, currentRegistry, chainMetadataOverrides),
      assembleChainAddresses(chainsInTokens, currentRegistry),
    ]);
    const multiProvider = new MultiProtocolProvider(chainMetadataWithOverrides);
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

    const routerAddressesByChainMap = getRouterAddressesByChain(warpCore.tokens);
    const coinGeckoIds = Array.from(
      new Set(coreConfig.tokens.map((t) => t.coinGeckoId).filter(Boolean)),
    ).sort() as string[];
    initE2EStateIfEnabled();
    markE2ERuntimeReady(() => buildE2ETokenSnapshot(warpCore.tokens));
    return {
      registry: currentRegistry,
      chainMetadata,
      chainAddresses,
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
      registry,
      chainMetadata: {},
      chainAddresses: {},
      multiProvider: new MultiProtocolProvider({}),
      warpCore: new WarpCore(new MultiProtocolProvider({}), []),
      routerAddressesByChainMap: {},
      tokens: [],
      collateralGroups: new Map(),
      tokenByKeyMap: new Map(),
      coinGeckoIds: [],
    };
  }
}

// Build map of chain -> set of router addresses
export function getRouterAddressesByChain(
  tokens: WarpCore['tokens'],
): Record<ChainName, Set<string>> {
  return tokens.reduce<Record<ChainName, Set<string>>>((acc, token) => {
    if (!token.addressOrDenom) return acc;
    acc[token.chainName] ||= new Set<string>();
    acc[token.chainName].add(normalizeAddress(token.addressOrDenom));
    return acc;
  }, {});
}
