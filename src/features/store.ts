import { GithubRegistry, IRegistry } from '@hyperlane-xyz/registry';
import type { ChainMetadata } from '@hyperlane-xyz/sdk/metadata/chainMetadataTypes';
import type { ConfiguredMultiProtocolProvider as MultiProtocolProvider } from '@hyperlane-xyz/sdk/providers/ConfiguredMultiProtocolProvider';
import type { Token } from '@hyperlane-xyz/sdk/token/Token';
import type { ChainMap, ChainName } from '@hyperlane-xyz/sdk/types';
import type { WarpCoreConfig } from '@hyperlane-xyz/sdk/warp/types';
import type { WarpCore } from '@hyperlane-xyz/sdk/warp/WarpCore';
import { type KnownProtocolType, objFilter } from '@hyperlane-xyz/utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { config } from '../consts/config';
import { logger } from '../utils/logger';
import type { initWarpContext as InitWarpContextFn, WarpRuntimeContext } from './storeInit';
import { getInitialTokenKeys } from './tokens/initialTokenKeys';
import { TokenChainMap } from './tokens/types';
import { FinalTransferStatuses, TransferContext, TransferStatus } from './transfer/types';
import { areRouteAccountsEqual, RouteAccounts } from './wallet/routeAccounts';
import { TokenSelectionMode } from './tokens/types';

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

let initWarpContextModulePromise:
  | Promise<{ initWarpContext: typeof InitWarpContextFn }>
  | undefined;
let runtimeContextLoader:
  | ((protocols?: KnownProtocolType[]) => Promise<WarpRuntimeContext>)
  | undefined;
let runtimeContextPromises = new Map<string, Promise<WarpRuntimeContext>>();
let runtimeProtocolsKey = '';
let runtimeContextVersion = 0;
let storeSetState: ((partial: Partial<AppState>) => void) | undefined;
let storeGetState: (() => AppState) | undefined;

function getRuntimeProtocolsKey(protocols?: KnownProtocolType[]) {
  return protocols?.length ? [...new Set(protocols)].sort().join(',') : '*';
}

async function loadWarpContextModule() {
  initWarpContextModulePromise ||= import('./storeInit');
  return initWarpContextModulePromise;
}

async function loadAndSetWarpRuntime(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
  protocols?: KnownProtocolType[],
  version = runtimeContextVersion,
) {
  const requestedProtocolsKey = getRuntimeProtocolsKey(protocols);
  if (get().warpCore) {
    if (runtimeProtocolsKey === '*') return get().warpCore;
    if (requestedProtocolsKey !== '*' && runtimeProtocolsKey === requestedProtocolsKey) {
      return get().warpCore;
    }
  }
  if (!runtimeContextLoader) return undefined;

  const runtimeContextPromise =
    runtimeContextPromises.get(requestedProtocolsKey) || runtimeContextLoader(protocols);
  runtimeContextPromises.set(requestedProtocolsKey, runtimeContextPromise);
  const runtimeContext = await runtimeContextPromise;
  if (version !== runtimeContextVersion) return get().warpCore;

  set(runtimeContext);
  runtimeProtocolsKey = requestedProtocolsKey;
  return runtimeContext.warpCore;
}

async function refreshWarpContext(
  nextState: Pick<AppState, 'registry' | 'chainMetadataOverrides' | 'warpCoreConfigOverrides'>,
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
) {
  const { initWarpContext } = await loadWarpContextModule();
  const { context, loadRuntime } = await initWarpContext(nextState);

  runtimeContextVersion += 1;
  runtimeContextLoader = loadRuntime;
  runtimeContextPromises = new Map();
  runtimeProtocolsKey = '';

  set({
    ...context,
    ...getInitialSelectedChains(context, get()),
  });
}

function getInitialSelectedChains(
  context: Pick<WarpContext, 'multiProvider' | 'tokenByKeyMap' | 'tokens'>,
  state: Pick<AppState, 'originChainName' | 'destinationChainName'>,
): Pick<AppState, 'originChainName' | 'destinationChainName'> | {} {
  if (!context.multiProvider) return {};
  if (state.originChainName && state.destinationChainName) return {};

  const { originTokenKey, destinationTokenKey } = getInitialTokenKeys(
    context.multiProvider,
    context.tokens,
  );
  const originChainName =
    state.originChainName || (originTokenKey && context.tokenByKeyMap.get(originTokenKey)?.chainName);
  const destinationChainName =
    state.destinationChainName ||
    (destinationTokenKey && context.tokenByKeyMap.get(destinationTokenKey)?.chainName);

  return {
    originChainName: originChainName || '',
    destinationChainName: destinationChainName || '',
  };
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
  ensureWarpRuntime: (protocols?: KnownProtocolType[]) => Promise<WarpCore | undefined>;

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
  showTokenSelectionModal: boolean;
  setShowTokenSelectionModal: (show: boolean) => void;
  activeTokenSelectionMode: TokenSelectionMode | null;
  setActiveTokenSelectionMode: (mode: TokenSelectionMode | null) => void;

  originChainName: ChainName;
  setOriginChainName: (originChainName: ChainName) => void;
  destinationChainName: ChainName;
  setDestinationChainName: (destinationChainName: ChainName) => void;
  routeAccounts: RouteAccounts;
  setRouteAccounts: (routeAccounts: RouteAccounts) => void;
  tokensBySymbolChainMap: Record<string, TokenChainMap>;
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
    (set, get) => {
      storeSetState = set;
      storeGetState = get;
      return {
        // Chains and providers
        chainMetadata: {},
        chainMetadataOverrides: {},
        isWarpContextReady: false,
        setChainMetadataOverrides: async (
          overrides: ChainMap<Partial<ChainMetadata> | undefined> = {},
        ) => {
          logger.debug('Setting chain overrides in store');
          const filtered = objFilter(overrides, (_, metadata) => !!metadata);
          await refreshWarpContext(
            {
              registry: get().registry,
              chainMetadataOverrides: filtered,
              warpCoreConfigOverrides: get().warpCoreConfigOverrides,
            },
            set,
            get,
          );
          set({ chainMetadataOverrides: filtered });
        },
        warpCoreConfigOverrides: [],
        setWarpCoreConfigOverrides: async (overrides: WarpCoreConfig[] | undefined = []) => {
          logger.debug('Setting warp core config overrides in store');
          await refreshWarpContext(
            {
              registry: get().registry,
              chainMetadataOverrides: get().chainMetadataOverrides,
              warpCoreConfigOverrides: overrides,
            },
            set,
            get,
          );
          set({ warpCoreConfigOverrides: overrides });
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
        ensureWarpRuntime: (protocols) => loadAndSetWarpRuntime(set, get, protocols),

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
              FinalTransferStatuses.includes(t.status)
                ? t
                : { ...t, status: TransferStatus.Failed },
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
        showTokenSelectionModal: false,
        setShowTokenSelectionModal: (showTokenSelectionModal) => {
          set(() => ({ showTokenSelectionModal }));
        },
        activeTokenSelectionMode: null,
        setActiveTokenSelectionMode: (activeTokenSelectionMode) => {
          set(() => ({ activeTokenSelectionMode }));
        },
        originChainName: '',
        setOriginChainName: (originChainName: ChainName) => {
          set(() => ({ originChainName }));
        },
        destinationChainName: '',
        setDestinationChainName: (destinationChainName: ChainName) => {
          set(() => ({ destinationChainName }));
        },
        routeAccounts: {},
        setRouteAccounts: (routeAccounts: RouteAccounts) => {
          set((state) =>
            areRouteAccountsEqual(state.routeAccounts, routeAccounts) ? state : { routeAccounts },
          );
        },
        tokensBySymbolChainMap: {},
        routerAddressesByChainMap: {},
        isTipCardActionTriggered: false,
        setIsTipCardActionTriggered: (isTipCardActionTriggered: boolean) => {
          set(() => ({ isTipCardActionTriggered }));
        },
        tokens: [],
        collateralGroups: new Map(),
        tokenByKeyMap: new Map(),
        coinGeckoIds: [],
      };
    },

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
          if (!storeSetState || !storeGetState) {
            logger.error(
              'Store API not ready during hydration',
              new Error('Store API unavailable'),
            );
            return;
          }
          refreshWarpContext(
            {
              registry: state.registry,
              chainMetadataOverrides: state.chainMetadataOverrides,
              warpCoreConfigOverrides: state.warpCoreConfigOverrides,
            },
            storeSetState,
            storeGetState,
          ).then(() => {
            logger.debug('Rehydration complete');
          });
        };
      },
    },
  ),
);
