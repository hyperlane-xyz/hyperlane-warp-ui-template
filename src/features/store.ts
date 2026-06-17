import {
  ChainAddresses,
  GithubRegistry,
  IRegistry,
  PartialRegistry,
} from '@hyperlane-xyz/registry';
import { ChainMap, ChainMetadata, ChainName, MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { objFilter } from '@hyperlane-xyz/utils';
import { toast } from 'react-toastify';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { config } from '../consts/config';
import { logger } from '../utils/logger';
import { routerClient } from './api/RouterClient';
import type { RouteResponse } from './api/types';
import { assembleChainAddresses } from './chains/addresses';
import { assembleChainMetadata } from './chains/metadata';
import type { UiToken } from './transfer/engine/tokens/types';
import { getTokenKey as getSwapTokenKey } from './transfer/engine/tokens/utils';
import {
  FinalSwapStatuses,
  LabeledMsgId,
  SwapHistoryItem,
  SwapStatus,
} from './transfer/engine/types';
import { initE2EStateIfEnabled, markE2ERuntimeReady } from './wallet/_e2e/windowState';

// Increment this when persist state has breaking changes
const PERSIST_STATE_VERSION = 5;

export const TransactionHistoryItemType = {
  Swap: 'swap',
} as const;

export type TransactionHistoryItem = {
  id: string;
  type: typeof TransactionHistoryItemType.Swap;
  data: SwapHistoryItem;
};

interface AppContext {
  registry: IRegistry;
  chainMetadata: ChainMap<ChainMetadata>;
  chainAddresses: ChainMap<ChainAddresses>;
  multiProvider: MultiProtocolProvider;
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
  multiProvider: MultiProtocolProvider;
  registry: IRegistry;
  setAppContext: (context: AppContext) => void;

  // User transaction history
  transactionHistory: TransactionHistoryItem[];
  addSwapTransaction: (s: SwapHistoryItem) => string;
  resetTransactionHistory: () => void;
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
  // through syncTokens so SwapForm / SwapDetailsModal lookups go through
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
        const { registry, chainMetadata, chainAddresses, multiProvider } = await initAppContext({
          ...get(),
          chainMetadataOverrides: filtered,
        });
        set({
          chainMetadataOverrides: filtered,
          registry,
          chainMetadata,
          chainAddresses,
          multiProvider,
        });
      },
      multiProvider: new MultiProtocolProvider({}),
      registry: new GithubRegistry({
        uri: config.registryUrl,
        branch: config.registryBranch,
        proxyUrl: config.registryProxyUrl,
      }),
      setAppContext: (context) => {
        logger.debug('Setting app context in store');
        set(context);
      },

      // User transaction history
      transactionHistory: [],
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
          let added = 0;
          const next = new Map(state.knownTokens);
          for (const t of newTokens) {
            const key = getSwapTokenKey(t);
            if (!next.has(key)) {
              next.set(key, t);
              added++;
            }
          }
          return added > 0 ? { knownTokens: next } : state;
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
      isTipCardActionTriggered: false,
      setIsTipCardActionTriggered: (isTipCardActionTriggered: boolean) => {
        set(() => ({ isTipCardActionTriggered }));
      },
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
      migrate: (persistedState) => {
        const state = persistedState as Partial<AppState> & {
          swaps?: SwapHistoryItem[];
          transactionHistory?: Array<TransactionHistoryItem | { type?: string }>;
        };
        if (Array.isArray(state.transactionHistory)) {
          return {
            chainMetadataOverrides: state.chainMetadataOverrides ?? {},
            transactionHistory: state.transactionHistory.filter(
              (item): item is TransactionHistoryItem =>
                item.type === TransactionHistoryItemType.Swap,
            ),
          };
        }

        const swaps = Array.isArray(state.swaps) ? state.swaps : [];
        const transactionHistory: TransactionHistoryItem[] = [
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
      },
      onRehydrateStorage: () => {
        logger.debug('Rehydrating state');
        return (state, error) => {
          state?.failUnconfirmedTransactions();
          if (error || !state) {
            logger.error('Error during hydration', error);
            return;
          }
          initAppContext(state).then((context) => {
            state.setAppContext(context);
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

async function initAppContext({
  registry,
  chainMetadataOverrides,
}: {
  registry: IRegistry;
  chainMetadataOverrides: ChainMap<Partial<ChainMetadata> | undefined>;
}): Promise<AppContext> {
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
    const engineChains = await routerClient.chains();
    const chainNames = Array.from(
      new Set(engineChains.chains.map((chain) => chain.chainName as ChainName)),
    );
    const [{ chainMetadata, chainMetadataWithOverrides }, chainAddresses] = await Promise.all([
      assembleChainMetadata(chainNames, currentRegistry, chainMetadataOverrides),
      assembleChainAddresses(chainNames, currentRegistry),
    ]);
    const multiProvider = new MultiProtocolProvider(chainMetadataWithOverrides);

    initE2EStateIfEnabled();
    markE2ERuntimeReady();
    return {
      registry: currentRegistry,
      chainMetadata,
      chainAddresses,
      multiProvider,
    };
  } catch (error) {
    toast.error('Error initializing app context. Please check connection status and configs.');
    logger.error('Error initializing app context', error);
    return {
      registry,
      chainMetadata: {},
      chainAddresses: {},
      multiProvider: new MultiProtocolProvider({}),
    };
  }
}
