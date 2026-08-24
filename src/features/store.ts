import { GithubRegistry, PartialRegistry } from '@hyperlane-xyz/registry';
import type { ChainAddresses, IRegistry } from '@hyperlane-xyz/registry';
import { ChainMap, ChainMetadata, ChainName, MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { objFilter } from '@hyperlane-xyz/utils';
import { toast } from 'react-toastify';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { chains as ChainsTS } from '../consts/chains';
import ChainsYaml from '../consts/chains.yaml';
import { config } from '../consts/config';
import { logger } from '../utils/logger';
import { routerClient } from './api/RouterClient';
import type { RouteResponse } from './api/types';
import { assembleChainAddresses } from './chains/addresses';
import { assembleChainMetadata } from './chains/metadata';
import { createConfiguredRegistry } from './registry';
import type { UiToken } from './tokens/types';
import { getTokenKey as getTransferTokenKey } from './tokens/utils';
import {
  FinalTransferStatuses,
  LabeledMsgId,
  TransferHistoryItem,
  TransferStatus,
} from './transfer/engine/types';
import { initE2EStateIfEnabled, markE2ERuntimeReady } from './wallet/_e2e/windowState';
import { loadRegistryWarpRoutes, type RegistryWarpRouteMap } from './warpRoutes/registryWarpRoutes';

// Increment this when persist state has breaking changes
const PERSIST_STATE_VERSION = 6;
const APP_CONTEXT_ENGINE_CHAIN_RETRIES = 3;
const APP_CONTEXT_ENGINE_CHAIN_TIMEOUT_MS = 2_500;

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

type LegacyTransferContext = {
  status?: string;
  origin?: ChainName;
  destination?: ChainName;
  originTokenAddressOrDenom?: string;
  destTokenAddressOrDenom?: string;
  amount?: string;
  sender?: string;
  recipient?: string;
  originTxHash?: string;
  originBlockNumber?: number;
  msgId?: string;
  destinationTxHash?: string;
  timestamp?: number;
};

interface AppContext {
  registry: IRegistry;
  chainMetadata: ChainMap<ChainMetadata>;
  chainAddresses: ChainMap<ChainAddresses>;
  registryWarpRoutes: RegistryWarpRouteMap;
  multiProvider: MultiProtocolProvider;
}
// Keeping everything here for now as state is simple
// Will refactor into slices as necessary
export interface AppState {
  // Chains and providers
  chainMetadata: ChainMap<ChainMetadata>;
  // Per-chain contract addresses, merged from registry + filesystem (addresses.yaml)
  chainAddresses: ChainMap<ChainAddresses>;
  // Registry warp route configs used by bridge-only route validation.
  registryWarpRoutes: RegistryWarpRouteMap;
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
        const { registry, chainMetadata, chainAddresses, registryWarpRoutes, multiProvider } =
          await initAppContext({
            ...get(),
            chainMetadataOverrides: filtered,
          });
        set({
          chainMetadataOverrides: filtered,
          registry,
          chainMetadata,
          chainAddresses,
          registryWarpRoutes,
          multiProvider,
        });
      },
      multiProvider: new MultiProtocolProvider({}),
      registryWarpRoutes: {},
      registry: createInitialRegistry(),
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
        set((state) => {
          let changed = false;
          const transactionHistory = state.transactionHistory.map((item) => {
            if (item.id !== id || item.type !== TransactionHistoryItemType.Transfer) return item;
            const data = mergeTransferTransactionUpdate(item.data, status, options);
            if (data === item.data) return item;
            changed = true;
            return {
              ...item,
              data,
            };
          });
          const transferRouteByTransactionId = removeFinalTransferRoute(
            state.transferRouteByTransactionId,
            id,
            status,
          );
          if (!changed && transferRouteByTransactionId === state.transferRouteByTransactionId) {
            return state;
          }
          const patch: Partial<AppState> = {};
          if (changed) patch.transactionHistory = transactionHistory;
          if (transferRouteByTransactionId !== state.transferRouteByTransactionId) {
            patch.transferRouteByTransactionId = transferRouteByTransactionId;
          }
          return patch;
        });
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
          const knownTokens = mergeKnownTokens(state.knownTokens, newTokens);
          return knownTokens === state.knownTokens ? state : { knownTokens };
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
      migrate: migratePersistedAppState,
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

type TransferTransactionUpdateOptions = Parameters<AppState['updateTransferTransactionStatus']>[2];

function createInitialRegistry(): IRegistry {
  return createConfiguredRegistry(config);
}

export async function migratePersistedAppState(persistedState: unknown) {
  const state = persistedState as Partial<AppState> & {
    swaps?: TransferHistoryItem[];
    transfers?: LegacyTransferContext[];
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

  const legacyTransfers = Array.isArray(state.transfers) ? state.transfers : [];
  const swaps = Array.isArray(state.swaps) ? state.swaps : [];
  const chainMetadataForMigration = await loadMigrationChainMetadata(state.chainMetadataOverrides);
  const transactionHistory: TransactionHistoryItem[] = [
    ...legacyTransfers.flatMap((data) => {
      const converted = convertLegacyTransferContext(data, chainMetadataForMigration);
      if (!converted) {
        logger.warn(
          'Dropped legacy transfer during migration because required fields are missing',
          {
            origin: data.origin,
            destination: data.destination,
            timestamp: data.timestamp,
          },
        );
      }
      return converted ? [converted] : [];
    }),
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
}

export function mergeTransferTransactionUpdate(
  data: TransferHistoryItem,
  status: TransferStatus,
  options?: TransferTransactionUpdateOptions,
): TransferHistoryItem {
  const msgIds = mergeMsgIds(data.msgIds, options?.msgIds);
  const next: TransferHistoryItem = {
    ...data,
    status,
    msgIds,
    originTxHash: data.originTxHash ?? options?.originTxHash,
    originBlockNumber: data.originBlockNumber ?? options?.originBlockNumber,
    destinationTxHash: data.destinationTxHash ?? options?.destinationTxHash,
    originTxTimestamp: data.originTxTimestamp ?? options?.originTxTimestamp,
  };

  return isSameTransferHistoryItem(data, next) ? data : next;
}

function mergeMsgIds(current: LabeledMsgId[] | undefined, next: LabeledMsgId[] | undefined) {
  if (!next) return current;
  if (!current || (current.length === 0 && next.length > 0)) return next;
  return current;
}

function isSameTransferHistoryItem(left: TransferHistoryItem, right: TransferHistoryItem) {
  return (
    left.status === right.status &&
    left.msgIds === right.msgIds &&
    left.originTxHash === right.originTxHash &&
    left.originBlockNumber === right.originBlockNumber &&
    left.destinationTxHash === right.destinationTxHash &&
    left.originTxTimestamp === right.originTxTimestamp
  );
}

export function removeFinalTransferRoute(
  routeByTransactionId: Map<string, RouteResponse>,
  transactionId: string,
  status: TransferStatus,
): Map<string, RouteResponse> {
  if (!FinalTransferStatuses.includes(status)) return routeByTransactionId;
  if (!routeByTransactionId.has(transactionId)) return routeByTransactionId;

  const next = new Map(routeByTransactionId);
  next.delete(transactionId);
  return next;
}

export function mergeKnownTokens(
  knownTokens: Map<string, UiToken>,
  newTokens: UiToken[],
): Map<string, UiToken> {
  let next: Map<string, UiToken> | undefined;
  for (const token of newTokens) {
    const key = getTransferTokenKey(token);
    const current = (next ?? knownTokens).get(key);
    if (current && isSameUiToken(current, token)) continue;

    next ??= new Map(knownTokens);
    next.set(key, token);
  }
  return next ?? knownTokens;
}

function isSameUiToken(left: UiToken, right: UiToken) {
  return (
    left.chainId === right.chainId &&
    left.address === right.address &&
    left.symbol === right.symbol &&
    left.standard === right.standard &&
    left.decimals === right.decimals &&
    left.isNative === right.isNative &&
    left.isBridgeToken === right.isBridgeToken &&
    left.isPoolToken === right.isPoolToken &&
    left.canBridge === right.canBridge &&
    left.canSwap === right.canSwap &&
    sameStringArray(left.bridgeSymbols, right.bridgeSymbols) &&
    sameStringArray(left.warpRouteIds, right.warpRouteIds) &&
    left.coinGeckoId === right.coinGeckoId &&
    left.chainName === right.chainName &&
    left.name === right.name &&
    left.addressOrDenom === right.addressOrDenom &&
    left.wrappedAddress === right.wrappedAddress &&
    left.logoURI === right.logoURI
  );
}

function sameStringArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, i) => item === right[i]);
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
  if (status === ('confirmed-transfer' as TransferStatus)) return TransferStatus.Bridging;
  if (status === ('delivered' as TransferStatus)) return TransferStatus.ConfirmedDestination;
  if (status === ('confirming-transfer' as TransferStatus)) return TransferStatus.ConfirmingOrigin;
  if (status === ('signing-swap' as TransferStatus)) return TransferStatus.SigningTransfer;
  if (status === ('dest-swap-failed' as TransferStatus)) return TransferStatus.DestTransferFailed;
  if (status === ('fetching-attestation' as TransferStatus)) return TransferStatus.Bridging;
  if (status === ('signing-revoke' as TransferStatus)) return TransferStatus.SigningTransfer;
  if (status === ('confirming-revoke' as TransferStatus)) return TransferStatus.ConfirmingOrigin;
  return status;
}

function convertLegacyTransferContext(
  item: LegacyTransferContext,
  chainMetadataForMigration: ChainMap<Partial<ChainMetadata>>,
): TransactionHistoryItem | null {
  const srcChain = chainSelectorForChainName(item.origin, chainMetadataForMigration);
  const dstChain = chainSelectorForChainName(item.destination, chainMetadataForMigration);
  if (
    srcChain == null ||
    dstChain == null ||
    !item.sender ||
    !item.recipient ||
    !item.amount ||
    !item.timestamp
  ) {
    return null;
  }

  const data: TransferHistoryItem = {
    status: normalizeTransferStatus((item.status ?? TransferStatus.Failed) as TransferStatus),
    timestamp: item.timestamp,
    srcChain,
    dstChain,
    srcToken: item.originTokenAddressOrDenom ?? '',
    dstToken: item.destTokenAddressOrDenom ?? '',
    amountIn: item.amount,
    amountOut: item.amount,
    sender: item.sender,
    recipient: item.recipient,
    originTxHash: item.originTxHash,
    originBlockNumber: item.originBlockNumber,
    destinationTxHash: item.destinationTxHash,
    msgIds: item.msgId ? [{ msgId: item.msgId, label: 'bridge' }] : undefined,
  };

  return {
    id: createTransactionId(TransactionHistoryItemType.Transfer, data.timestamp),
    type: TransactionHistoryItemType.Transfer,
    data,
  };
}

function chainSelectorForChainName(
  chainName: ChainName | undefined,
  chainMetadataForMigration: ChainMap<Partial<ChainMetadata>>,
): number | null {
  if (!chainName) return null;
  const metadata = chainMetadataForMigration[chainName];
  const selector = metadata?.domainId ?? metadata?.chainId;
  if (typeof selector === 'number') return selector;
  if (typeof selector === 'string') {
    const parsed = Number(selector);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function loadMigrationChainMetadata(
  overrides: ChainMap<Partial<ChainMetadata> | undefined> | undefined,
): Promise<ChainMap<Partial<ChainMetadata>>> {
  const { chainMetadata } = await import('@hyperlane-xyz/registry');
  const merged = mergeMigrationChainMetadata(chainMetadata, { ...ChainsYaml, ...ChainsTS });
  for (const [chainName, override] of Object.entries(overrides ?? {})) {
    if (!override) continue;
    merged[chainName] = { ...merged[chainName], ...override };
  }
  return merged;
}

export function mergeMigrationChainMetadata(
  registryMetadata: ChainMap<Partial<ChainMetadata>>,
  filesystemMetadata: ChainMap<Partial<ChainMetadata>>,
): ChainMap<Partial<ChainMetadata>> {
  return { ...registryMetadata, ...filesystemMetadata };
}

let publishedRegistryPromise: Promise<IRegistry> | undefined;

async function getPublishedRegistry(): Promise<IRegistry> {
  publishedRegistryPromise ??= import('@hyperlane-xyz/registry')
    .then(
      ({ chainAddresses, chainMetadata }) =>
        new PartialRegistry({
          chainAddresses,
          chainMetadata,
        }),
    )
    .catch((error) => {
      publishedRegistryPromise = undefined;
      throw error;
    });
  return publishedRegistryPromise;
}

async function initAppContext({
  registry,
  chainMetadataOverrides,
}: {
  registry: IRegistry;
  chainMetadataOverrides: ChainMap<Partial<ChainMetadata> | undefined>;
}): Promise<AppContext> {
  let currentRegistry = registry;
  if (currentRegistry instanceof GithubRegistry) {
    try {
      // Pre-load real custom registry content to avoid repeated requests.
      await currentRegistry.listRegistryContent();
    } catch (error) {
      currentRegistry = await getPublishedRegistry();
      logger.warn(
        'Failed to list registry content using GithubRegistry, will continue with PartialRegistry.',
        error,
      );
    }
  }

  try {
    const engineChains = await fetchEngineChainsWithRetry();
    const chainNames = Array.from(
      new Set(engineChains.chains.map((chain) => chain.chainName as ChainName)),
    );
    const [{ chainMetadata, chainMetadataWithOverrides }, chainAddresses, registryWarpRoutes] =
      await Promise.all([
        assembleChainMetadata(chainNames, currentRegistry, chainMetadataOverrides),
        assembleChainAddresses(chainNames, currentRegistry),
        loadRegistryWarpRoutes(currentRegistry),
      ]);
    const multiProvider = new MultiProtocolProvider(chainMetadataWithOverrides);

    initE2EStateIfEnabled();
    markE2ERuntimeReady();
    return {
      registry: currentRegistry,
      chainMetadata,
      chainAddresses,
      registryWarpRoutes,
      multiProvider,
    };
  } catch (error) {
    toast.error('Error initializing app context. Please check connection status and configs.');
    logger.error('Error initializing app context', error);
    return {
      registry,
      chainMetadata: {},
      chainAddresses: {},
      registryWarpRoutes: {},
      multiProvider: new MultiProtocolProvider({}),
    };
  }
}

async function fetchEngineChainsWithRetry() {
  let lastError: unknown;
  for (let attempt = 1; attempt <= APP_CONTEXT_ENGINE_CHAIN_RETRIES; attempt++) {
    try {
      return await routerClient.chains({ timeoutMs: APP_CONTEXT_ENGINE_CHAIN_TIMEOUT_MS });
    } catch (error) {
      lastError = error;
      if (attempt < APP_CONTEXT_ENGINE_CHAIN_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }
  throw lastError;
}
