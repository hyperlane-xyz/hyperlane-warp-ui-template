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
import type { RouteResponse } from './api/types';
import { assembleChainAddresses } from './chains/addresses';
import { assembleChainMetadata } from './chains/metadata';
import type { UiToken } from './swap/tokens/types';
import { getTokenKey as getSwapTokenKey } from './swap/tokens/utils';
import { FinalSwapStatuses, LabeledMsgId, SwapHistoryItem, SwapStatus } from './swap/types';
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
const PERSIST_STATE_VERSION = 3;

export const TransactionHistoryItemType = {
  Bridge: 'bridge',
  Swap: 'swap',
} as const;

export type TransactionHistoryItem =
  | { id: string; type: typeof TransactionHistoryItemType.Bridge; data: TransferContext }
  | { id: string; type: typeof TransactionHistoryItemType.Swap; data: SwapHistoryItem };

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

  // User transaction history
  transactionHistory: TransactionHistoryItem[];
  addBridgeTransaction: (t: TransferContext) => string;
  addSwapTransaction: (s: SwapHistoryItem) => string;
  resetTransactionHistory: () => void;
  updateBridgeTransactionStatus: (
    id: string,
    s: TransferStatus,
    options?: {
      msgId?: string;
      originTxHash?: string;
      originBlockNumber?: number;
      destinationTxHash?: string;
    },
  ) => void;
  updateSwapTransactionStatus: (
    id: string,
    status: SwapStatus,
    options?: {
      msgIds?: LabeledMsgId[];
      originTxHash?: string;
      originBlockNumber?: number;
      destinationTxHash?: string;
      originTxTimestamp?: number;
    },
  ) => void;
  // Non-persisted: routes for active swap transactions, keyed by transactionId.
  // Cleared on page reload. Used by useSwapStatus.
  swapRouteByTransactionId: Map<string, RouteResponse>;
  setSwapRoute: (transactionId: string, route: RouteResponse) => void;
  failUnconfirmedTransactions: () => void;
  selectedTransactionId: string | null;
  setSelectedTransactionId: (id: string | null) => void;
  activeSwapTransactionId: string | null;
  setActiveSwapTransactionId: (id: string | null) => void;
  // Accumulated engine-token catalogue. Every useTokens() result funnels
  // through syncTokens so unified swap flows / SwapDetailsModal lookups go through
  // one place. Keyed by getSwapTokenKey (chainId-address). Not persisted.
  knownTokens: Map<string, UiToken>;
  syncTokens: (tokens: UiToken[]) => void;

  // Shared component state
  transferLoading: boolean;
  setTransferLoading: (isLoading: boolean) => void;
  swapLoading: boolean;
  setSwapLoading: (isLoading: boolean) => void;
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
  // Deduplicated, sorted CoinGecko IDs for the warpCore token set (built
  // at WarpContext init). Consumed by the bridge `useTokenPrices` wrapper
  // which delegates to the shared `useTokenPricesByIds` cache below.
  coinGeckoIds: string[];
  // Session-scoped USD price cache, keyed by coinGeckoId. `failedAt`
  // backs off retries after rate-limit / network failures.
  tokenPrices: Record<string, { usd?: number; fetchedAt?: number; failedAt?: number }>;
  mergeTokenPrices: (
    succeededIds: string[],
    fetched: Record<string, number>,
    failedIds: string[],
  ) => void;
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
          registry,
          chainMetadata,
          chainAddresses,
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
          registry,
          chainMetadata,
          chainAddresses,
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
          registry,
          chainMetadata,
          chainAddresses,
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
          registry,
          chainMetadata,
          chainAddresses,
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

      // User transaction history
      transactionHistory: [],
      addBridgeTransaction: (data) => {
        const id = createTransactionId(TransactionHistoryItemType.Bridge, data.timestamp);
        set((state) => ({
          transactionHistory: [
            ...state.transactionHistory,
            { id, type: TransactionHistoryItemType.Bridge, data },
          ],
        }));
        return id;
      },
      addSwapTransaction: (data) => {
        const id = createTransactionId(TransactionHistoryItemType.Swap, data.timestamp);
        set((state) => ({
          transactionHistory: [
            ...state.transactionHistory,
            { id, type: TransactionHistoryItemType.Swap, data },
          ],
        }));
        return id;
      },
      resetTransactionHistory: () => {
        set(() => ({ transactionHistory: [] }));
      },
      updateBridgeTransactionStatus: (id, status, options) => {
        set((state) => ({
          transactionHistory: state.transactionHistory.map((item) => {
            if (item.id !== id || item.type !== TransactionHistoryItemType.Bridge) return item;
            return {
              ...item,
              data: {
                ...item.data,
                status,
                msgId: item.data.msgId ?? options?.msgId,
                originTxHash: item.data.originTxHash ?? options?.originTxHash,
                originBlockNumber: item.data.originBlockNumber ?? options?.originBlockNumber,
                destinationTxHash: item.data.destinationTxHash ?? options?.destinationTxHash,
              },
            };
          }),
        }));
      },
      updateSwapTransactionStatus: (id, status, options) => {
        set((state) => ({
          transactionHistory: state.transactionHistory.map((item) => {
            if (item.id !== id || item.type !== TransactionHistoryItemType.Swap) return item;
            return {
              ...item,
              data: {
                ...item.data,
                status,
                msgIds: item.data.msgIds ?? options?.msgIds,
                originTxHash: item.data.originTxHash ?? options?.originTxHash,
                originBlockNumber: item.data.originBlockNumber ?? options?.originBlockNumber,
                destinationTxHash: item.data.destinationTxHash ?? options?.destinationTxHash,
                originTxTimestamp: item.data.originTxTimestamp ?? options?.originTxTimestamp,
              },
            };
          }),
        }));
      },
      swapRouteByTransactionId: new Map(),
      setSwapRoute: (transactionId, route) => {
        set((state) => {
          const next = new Map(state.swapRouteByTransactionId);
          next.set(transactionId, route);
          return { swapRouteByTransactionId: next };
        });
      },
      failUnconfirmedTransactions: () => {
        set((state) => ({
          transactionHistory: state.transactionHistory.map((item) => {
            if (item.type === TransactionHistoryItemType.Bridge) {
              if (FinalTransferStatuses.includes(item.data.status)) return item;
              return { ...item, data: { ...item.data, status: TransferStatus.Failed } };
            }
            if (FinalSwapStatuses.includes(item.data.status)) return item;
            if (item.data.originTxHash) return item;
            return { ...item, data: { ...item.data, status: SwapStatus.Failed } };
          }),
        }));
      },
      selectedTransactionId: null,
      setSelectedTransactionId: (selectedTransactionId) => {
        set(() => ({ selectedTransactionId }));
      },
      activeSwapTransactionId: null,
      setActiveSwapTransactionId: (activeSwapTransactionId) => {
        set(() => ({ activeSwapTransactionId }));
      },
      knownTokens: new Map(),
      syncTokens: (newTokens) => {
        set((state) => {
          let changed = false;
          const next = new Map(state.knownTokens);
          for (const t of newTokens) {
            const key = getSwapTokenKey(t);
            const existing = next.get(key);
            if (!existing || !areUiTokensEqual(existing, t)) {
              next.set(key, t);
              changed = true;
            }
          }
          return changed ? { knownTokens: next } : state;
        });
      },

      tokenPrices: {},
      mergeTokenPrices: (succeededIds, fetched, failedIds) => {
        set((state) => {
          const now = Date.now();
          const next = { ...state.tokenPrices };
          for (const id of succeededIds) {
            next[id] = { usd: fetched[id], fetchedAt: now };
          }
          for (const id of failedIds) {
            next[id] = { ...next[id], failedAt: now };
          }
          return { tokenPrices: next };
        });
      },

      // Shared component state
      transferLoading: false,
      setTransferLoading: (isLoading) => {
        set(() => ({ transferLoading: isLoading }));
      },
      swapLoading: false,
      setSwapLoading: (isLoading) => {
        set(() => ({ swapLoading: isLoading }));
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
        transactionHistory: state.transactionHistory,
      }),
      version: PERSIST_STATE_VERSION,
      migrate: migratePersistedAppState,
      onRehydrateStorage: () => {
        logger.debug('Rehydrating state');
        return (state, error) => {
          state?.failUnconfirmedTransactions();
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

function createTransactionId(type: TransactionHistoryItem['type'], timestamp: number): string {
  const suffix =
    crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return `${type}-${timestamp}-${suffix}`;
}

export function migratePersistedAppState(persistedState: unknown): {
  chainMetadataOverrides: ChainMap<Partial<ChainMetadata>>;
  transactionHistory: TransactionHistoryItem[];
} {
  const state = persistedState as Partial<AppState> & {
    transfers?: TransferContext[];
    swaps?: SwapHistoryItem[];
  };
  if (Array.isArray(state.transactionHistory)) {
    return {
      chainMetadataOverrides: state.chainMetadataOverrides ?? {},
      transactionHistory: state.transactionHistory,
    };
  }

  const transfers = Array.isArray(state.transfers) ? state.transfers : [];
  const swaps = Array.isArray(state.swaps) ? state.swaps : [];
  const transactionHistory: TransactionHistoryItem[] = [
    ...transfers.map((data) => ({
      id: createTransactionId(TransactionHistoryItemType.Bridge, data.timestamp),
      type: TransactionHistoryItemType.Bridge,
      data,
    })),
    ...swaps.map((data) => ({
      id: createTransactionId(TransactionHistoryItemType.Swap, data.timestamp),
      type: TransactionHistoryItemType.Swap,
      data,
    })),
  ];

  return {
    chainMetadataOverrides: state.chainMetadataOverrides ?? {},
    transactionHistory,
  };
}

function areUiTokensEqual(a: UiToken, b: UiToken): boolean {
  return (
    a.chainId === b.chainId &&
    a.address === b.address &&
    a.symbol === b.symbol &&
    a.decimals === b.decimals &&
    a.isNative === b.isNative &&
    a.wrappedAddress === b.wrappedAddress &&
    a.isBridgeToken === b.isBridgeToken &&
    a.isPoolToken === b.isPoolToken &&
    a.isUserToken === b.isUserToken &&
    a.canBridge === b.canBridge &&
    a.canSwap === b.canSwap &&
    a.balance === b.balance &&
    a.chainName === b.chainName &&
    a.name === b.name &&
    a.addressOrDenom === b.addressOrDenom &&
    a.logoURI === b.logoURI &&
    a.coinGeckoId === b.coinGeckoId &&
    arraysEqual(a.bridgeSymbols, b.bridgeSymbols) &&
    arraysEqual(a.warpRouteIds, b.warpRouteIds)
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

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
