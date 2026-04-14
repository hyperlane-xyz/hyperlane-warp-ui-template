import { GithubRegistry, IRegistry } from '@hyperlane-xyz/registry';
import type { ChainMetadata } from '@hyperlane-xyz/sdk/metadata/chainMetadataTypes';
import type { MultiProviderAdapter as MultiProtocolProvider } from '@hyperlane-xyz/sdk/providers/MultiProviderAdapter';
import type { Token } from '@hyperlane-xyz/sdk/token/Token';
import type { ChainMap, ChainName } from '@hyperlane-xyz/sdk/types';
import type { WarpCoreConfig } from '@hyperlane-xyz/sdk/warp/types';
import type { WarpCore } from '@hyperlane-xyz/sdk/warp/WarpCore';
import { objFilter } from '@hyperlane-xyz/utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { config } from '../consts/config';
import { logger } from '../utils/logger';
import type { RouterAddressInfo } from './routerAddresses';
import type { initWarpContext as InitWarpContextFn, WarpRuntimeContext } from './storeInit';
import { TokenChainMap } from './tokens/types';
import { setResolvedUnderlyingMap } from './tokens/utils';
import { FinalTransferStatuses, TransferContext, TransferStatus } from './transfer/types';

// Increment this when persist state has breaking changes
const PERSIST_STATE_VERSION = 2;

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
let runtimeContextLoader: (() => Promise<WarpRuntimeContext>) | undefined;
let runtimeContextPromise: Promise<WarpRuntimeContext> | undefined;
let runtimeContextVersion = 0;
let storeSetState: ((partial: Partial<AppState>) => void) | undefined;
let storeGetState: (() => AppState) | undefined;

async function loadWarpContextModule() {
  initWarpContextModulePromise ||= import('./storeInit');
  return initWarpContextModulePromise;
}

async function loadAndSetWarpRuntime(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
  version = runtimeContextVersion,
) {
  if (get().warpCore) return get().warpCore;
  if (!runtimeContextLoader) return undefined;

  runtimeContextPromise ||= runtimeContextLoader();
  let runtimeContext: WarpRuntimeContext;
  try {
    runtimeContext = await runtimeContextPromise;
  } catch (error) {
    runtimeContextPromise = undefined;
    throw error;
  }
  if (version !== runtimeContextVersion) return get().warpCore;

  const { resolvedUnderlyingMap, ...nextRuntimeContext } = runtimeContext;
  setResolvedUnderlyingMap(resolvedUnderlyingMap);
  set(nextRuntimeContext);
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
  runtimeContextPromise = undefined;

  set(context);
  void loadAndSetWarpRuntime(set, get, runtimeContextVersion);
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
  ensureWarpRuntime: () => Promise<WarpCore | undefined>;

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
        ensureWarpRuntime: () => loadAndSetWarpRuntime(set, get),

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
        originChainName: '',
        setOriginChainName: (originChainName: ChainName) => {
          set(() => ({ originChainName }));
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
