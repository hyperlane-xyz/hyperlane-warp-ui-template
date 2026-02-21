import {
  chainAddresses,
  chainMetadata,
  GithubRegistry,
  HttpClientRegistry,
  IRegistry,
  PartialRegistry,
} from '@hyperlane-xyz/registry';
import {
  ChainMap,
  ChainMetadata,
  ChainName,
  MultiProtocolProvider,
  WarpCore,
  WarpCoreConfig,
} from '@hyperlane-xyz/sdk';
import { normalizeAddress, objFilter } from '@hyperlane-xyz/utils';
import { toast } from 'react-toastify';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { config } from '../consts/config';
import { logger } from '../utils/logger';
import { assembleChainMetadata } from './chains/metadata';
import { TokenChainMap } from './tokens/types';
import { assembleTokensBySymbolChainMap } from './tokens/utils';
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
  registry: IRegistry;
  chainMetadata: ChainMap<ChainMetadata>;
  multiProvider: MultiProtocolProvider;
  warpCore: WarpCore;
  tokensBySymbolChainMap: Record<string, TokenChainMap>;
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
    options?: { msgId?: string; originTxHash?: string },
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
      setChainMetadataOverrides: async (
        overrides: ChainMap<Partial<ChainMetadata> | undefined> = {},
      ) => {
        logger.debug('Setting chain overrides in store');
        const filtered = objFilter(overrides, (_, metadata) => !!metadata);
        const {
          multiProvider,
          warpCore,
          routerAddressesByChainMap,
          tokensBySymbolChainMap,
          coinGeckoIds,
        } = await initWarpContext({
          ...get(),
          chainMetadataOverrides: filtered,
        });
        set({
          chainMetadataOverrides: filtered,
          multiProvider,
          warpCore,
          tokensBySymbolChainMap,
          routerAddressesByChainMap,
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
          tokensBySymbolChainMap,
          coinGeckoIds,
        } = await initWarpContext({
          ...get(),
          warpCoreConfigOverrides: overrides,
        });
        set({
          warpCoreConfigOverrides: overrides,
          multiProvider,
          warpCore,
          tokensBySymbolChainMap,
          routerAddressesByChainMap,
          coinGeckoIds,
        });
      },
      multiProvider: new MultiProtocolProvider({}),
      registry: config.registryUrl?.startsWith("http://") ? new HttpClientRegistry(config.registryUrl) : new GithubRegistry({
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
      tokensBySymbolChainMap: {},
      routerAddressesByChainMap: {},
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
    const multiProvider = new MultiProtocolProvider(chainMetadataWithOverrides);
    const warpCore = WarpCore.FromConfig(multiProvider, coreConfig);

    const tokensBySymbolChainMap = assembleTokensBySymbolChainMap(warpCore.tokens, multiProvider);
    const routerAddressesByChainMap = getRouterAddressesByChain(warpCore.tokens, wireDecimalsMap);
    const coinGeckoIds = Array.from(
      new Set(coreConfig.tokens.map((t) => t.coinGeckoId).filter(Boolean)),
    ).sort() as string[];
    return {
      registry: currentRegistry,
      chainMetadata,
      multiProvider,
      warpCore,
      tokensBySymbolChainMap,
      routerAddressesByChainMap,
      coinGeckoIds,
    };
  } catch (error) {
    toast.error('Error initializing warp context. Please check connection status and configs.');
    logger.error('Error initializing warp context', error);
    return {
      registry,
      chainMetadata: {},
      multiProvider: new MultiProtocolProvider({}),
      warpCore: new WarpCore(new MultiProtocolProvider({}), []),
      tokensBySymbolChainMap: {},
      routerAddressesByChainMap: {},
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
