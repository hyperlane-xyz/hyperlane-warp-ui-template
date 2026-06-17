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
import { getTokenKey as getTransferTokenKey } from './transfer/engine/tokens/utils';
import {
  FinalTransferStatuses,
  LabeledMsgId,
  TransferHistoryItem,
  TransferStatus,
} from './transfer/engine/types';
import { initE2EStateIfEnabled, markE2ERuntimeReady } from './wallet/_e2e/windowState';

// Increment this when persist state has breaking changes
const PERSIST_STATE_VERSION = 6;

export const TransactionHistoryItemType = {
  Transfer: 'transfer',
} as const;

export type TransactionHistoryItem = {
  id: string;
  type: typeof TransactionHistoryItemType.Transfer;
  data: TransferHistoryItem;
};

type PersistedTransactionHistoryItem =
  | TransactionHistoryItem
  | {
      id?: string;
      type?: string;
      data?: TransferHistoryItem;
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
  addTransferTransaction: (s: TransferHistoryItem) => string;
  resetTransactionHistory: () => void;
  updateTransferTransactionStatus: (
    id: string,
    status: TransferStatus,
    options?: {
      msgIds?: LabeledMsgId[];
      originTxHash?: string;
      originBlockNumber?: number;
      destinationTxHash?: string;
      originTxTimestamp?: number;
    },
  ) => void;
  // Non-persisted: routes for active transfer transactions, keyed by transactionId.
  // Cleared on page reload. Used by useTransferStatus.
  transferRouteByTransactionId: Map<string, RouteResponse>;
  setTransferRoute: (transactionId: string, route: RouteResponse) => void;
  failUnconfirmedTransactions: () => void;
  selectedTransactionId: string | null;
  setSelectedTransactionId: (id: string | null) => void;
  activeTransferTransactionId: string | null;
  setActiveTransferTransactionId: (id: string | null) => void;
  // Accumulated engine-token catalogue. Every useTokens() result funnels
  // through syncTokens so TransferForm / TransferDetailsModal lookups go through
  // one place. Keyed by getTransferTokenKey (chainId-address). Not persisted.
  knownTokens: Map<string, UiToken>;
  syncTokens: (tokens: UiToken[]) => void;

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
      addTransferTransaction: (data) => {
        const id = createTransactionId(TransactionHistoryItemType.Transfer, data.timestamp);
        set((state) => ({
          transactionHistory: [
            ...state.transactionHistory,
            { id, type: TransactionHistoryItemType.Transfer, data },
          ],
        }));
        return id;
      },
      resetTransactionHistory: () => {
        set(() => ({ transactionHistory: [] }));
      },
      updateTransferTransactionStatus: (id, status, options) => {
        set((state) => ({
          transactionHistory: state.transactionHistory.map((item) => {
            if (item.id !== id || item.type !== TransactionHistoryItemType.Transfer) return item;
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
      transferRouteByTransactionId: new Map(),
      setTransferRoute: (transactionId, route) => {
        set((state) => {
          const next = new Map(state.transferRouteByTransactionId);
          next.set(transactionId, route);
          return { transferRouteByTransactionId: next };
        });
      },
      failUnconfirmedTransactions: () => {
        set((state) => ({
          transactionHistory: state.transactionHistory.map((item) => {
            if (FinalTransferStatuses.includes(item.data.status)) return item;
            if (item.data.originTxHash) return item;
            return { ...item, data: { ...item.data, status: TransferStatus.Failed } };
          }),
        }));
      },
      selectedTransactionId: null,
      setSelectedTransactionId: (selectedTransactionId) => {
        set(() => ({ selectedTransactionId }));
      },
      activeTransferTransactionId: null,
      setActiveTransferTransactionId: (activeTransferTransactionId) => {
        set(() => ({ activeTransferTransactionId }));
      },
      knownTokens: new Map(),
      syncTokens: (newTokens) => {
        set((state) => {
          let added = 0;
          const next = new Map(state.knownTokens);
          for (const t of newTokens) {
            const key = getTransferTokenKey(t);
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
          swaps?: TransferHistoryItem[];
          transactionHistory?: PersistedTransactionHistoryItem[];
        };
        if (Array.isArray(state.transactionHistory)) {
          return {
            chainMetadataOverrides: state.chainMetadataOverrides ?? {},
            transactionHistory: state.transactionHistory
              .map(normalizePersistedTransactionHistoryItem)
              .filter((item): item is TransactionHistoryItem => !!item),
          };
        }

        const swaps = Array.isArray(state.swaps) ? state.swaps : [];
        const transactionHistory: TransactionHistoryItem[] = [
          ...swaps.map((data) => ({
            id: createTransactionId(TransactionHistoryItemType.Transfer, data.timestamp),
            type: TransactionHistoryItemType.Transfer,
            data: normalizeTransferHistoryItem(data),
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

function normalizePersistedTransactionHistoryItem(
  item: PersistedTransactionHistoryItem,
): TransactionHistoryItem | null {
  if (!item.data) return null;
  if (item.type !== TransactionHistoryItemType.Transfer && item.type !== 'swap') return null;

  const data = normalizeTransferHistoryItem(item.data);
  const id =
    typeof item.id === 'string'
      ? item.id.replace(/^swap-/, `${TransactionHistoryItemType.Transfer}-`)
      : createTransactionId(TransactionHistoryItemType.Transfer, data.timestamp);

  return {
    id,
    type: TransactionHistoryItemType.Transfer,
    data,
  };
}

function normalizeTransferHistoryItem(data: TransferHistoryItem): TransferHistoryItem {
  return {
    ...data,
    status: normalizeTransferStatus(data.status),
  };
}

function normalizeTransferStatus(status: TransferStatus): TransferStatus {
  if (status === ('signing-swap' as TransferStatus)) return TransferStatus.SigningTransfer;
  if (status === ('dest-swap-failed' as TransferStatus)) return TransferStatus.DestTransferFailed;
  return status;
}

async function initAppContext({
  registry,
  chainMetadataOverrides,
}: {
  registry: IRegistry;
  chainMetadataOverrides: ChainMap<Partial<ChainMetadata> | undefined>;
}): Promise<AppContext> {
  let currentRegistry = registry;
  if (config.registryUrl) {
    try {
      // Pre-load real custom registry content to avoid repeated requests.
      await currentRegistry.listRegistryContent();
    } catch (error) {
      // Lazy-load the published constants so they stay out of the initial bundle.
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
