import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks for external deps ----------------------------------------------

// Keep a place to capture calls from assembleChainMetadata to assert
const capture = {
  lastChainMetadataOverridesArg: undefined as any,
  lastWarpCoreConfigOverridesArg: undefined as any,
};

vi.mock('@hyperlane-xyz/registry', () => {
  class GithubRegistry {
    uri: string;
    branch: string;
    proxyUrl?: string;
    constructor({ uri, branch, proxyUrl }: any) {
      this.uri = uri;
      this.branch = branch;
      this.proxyUrl = proxyUrl;
    }
    async listRegistryContent() {
      /* no-op */
    }
  }
  return { GithubRegistry, IRegistry: class {} };
});

vi.mock('@hyperlane-xyz/sdk', () => {
  class MultiProtocolProvider {
    cfg: any;
    constructor(cfg: any) {
      this.cfg = cfg;
    }
  }
  class WarpCore {
    provider: any;
    tokens: any[];
    constructor(provider: any, tokens: any[]) {
      this.provider = provider;
      this.tokens = tokens;
    }
    static FromConfig(provider: any, coreConfig: any) {
      return new WarpCore(provider, coreConfig.tokens || []);
    }
  }
  const WarpCoreConfigSchema = {
    safeParse: (input: any) => ({ success: true, data: input }),
  };
  const validateZodResult = (result: any) => {
    if (!result?.success) throw new Error('Invalid schema');
    return result.data;
  };
  // Utility types only; in tests we just need the shape, not real typings
  return {
    MultiProtocolProvider,
    WarpCore,
    ChainName: String as unknown as { new (): string },
    WarpCoreConfigSchema,
    validateZodResult,
  };
});

vi.mock('@hyperlane-xyz/utils', () => {
  // Minimal enum stub to satisfy config imports
  const ProtocolType = {
    Ethereum: 'Ethereum',
    Sealevel: 'Sealevel',
    Cosmos: 'Cosmos',
    Starknet: 'Starknet',
  } as const;
  // A simple pass-through filter to simulate objFilter behavior
  return {
    ProtocolType,
    objFilter: (obj: Record<string, any>, predicate: (k: string, v: any) => boolean) => {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj || {})) {
        if (predicate(k, v)) out[k] = v;
      }
      return out;
    },
    objMerge: (base: Record<string, any> = {}, next: Record<string, any> = {}) => ({
      ...base,
      ...next,
    }),
  };
});

const toastErrorSpy = vi.fn();
vi.mock('react-toastify', () => ({
  toast: { error: toastErrorSpy },
}));

// Your app config
vi.mock('../consts/config', () => ({
  config: {
    registryUrl: 'https://example.com',
    registryBranch: 'main',
    registryProxyUrl: undefined,
    useOnlineRegistry: false,
  },
}));

// Logger is just silenced (but we keep debug/error spies if you want to assert later)
const loggerDebugSpy = vi.fn();
const loggerErrorSpy = vi.fn();
vi.mock('../utils/logger', () => ({
  logger: {
    debug: loggerDebugSpy,
    error: loggerErrorSpy,
  },
}));

// Chain & tokens helpers used by initWarpContext
vi.mock('../chains/metadata', () => ({
  assembleChainMetadata: vi.fn(
    async (_chainsInTokens: string[], _registry: any, chainMetadataOverrides: any) => {
      // Capture the overrides to assert filtering behavior
      capture.lastChainMetadataOverridesArg = chainMetadataOverrides;
      return {
        chainMetadata: { A: { chainId: 1 }, B: { chainId: 2 } },
        chainMetadataWithOverrides: {
          A: { chainId: 1 },
          B: { chainId: 2 },
          ...chainMetadataOverrides,
        },
      };
    },
  ),
}));

vi.mock('../tokens/utils', () => ({
  assembleTokensBySymbolChainMap: vi.fn((_tokens: any[], _mp: any) => ({
    USDC: { A: { symbol: 'USDC', chainName: 'A' } },
  })),
}));

vi.mock('../warpCore/warpCoreConfig', () => ({
  assembleWarpCoreConfig: vi.fn(async (overrides: any /* WarpCoreConfig[] */, _registry: any) => {
    // Capture overrides to assert they were forwarded correctly
    capture.lastWarpCoreConfigOverridesArg = overrides;
    // Minimal coreConfig with tokens
    return {
      tokens: [
        { symbol: 'USDC', chainName: 'A', addressOrDenom: '0xrouterA' },
        { symbol: 'USDT', chainName: 'B', addressOrDenom: '0xrouterB' },
      ],
    };
  }),
}));

// Transfer types (keep it tiny)
vi.mock('../transfer/types', () => ({
  TransferStatus: {
    Pending: 'Pending',
    Completed: 'Completed',
    Failed: 'Failed',
  },
  FinalTransferStatuses: ['Completed', 'Failed'],
}));

// --- Helper to re-import a fresh store per test ----------------------------
async function freshStore() {
  vi.resetModules();
  // re-apply mocks after reset
  await import('@hyperlane-xyz/registry');
  await import('@hyperlane-xyz/sdk');
  await import('@hyperlane-xyz/utils');
  await import('react-toastify');
  await import('../../consts/config');
  await import('../../utils/logger');
  await import('./../chains/metadata');
  await import('./../tokens/utils');
  await import('./../warpCore/warpCoreConfig');
  await import('./../transfer/types');

  const mod = await import('./../store');
  return mod;
}

describe('Zustand App Store', () => {
  let useStore: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await freshStore();
    useStore = mod.useStore;
    useStore.persist?.clearStorage?.();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has sane initial state', () => {
    const s = useStore.getState();
    expect(s.transfers).toEqual([]);
    expect(s.transferLoading).toBe(false);
    expect(s.isSideBarOpen).toBe(false);
    expect(s.showEnvSelectModal).toBe(false);
    expect(s.originChainName).toBe('');
    expect(typeof s.setChainMetadataOverrides).toBe('function');
    expect(typeof s.setWarpCoreConfigOverrides).toBe('function');
  });

  it('manages transfer history: add/reset/update/failUnconfirmed', () => {
    const { addTransfer, resetTransfers, updateTransferStatus, failUnconfirmedTransfers } =
      useStore.getState();
    addTransfer({ status: 'Pending', msgId: undefined, originTxHash: undefined });
    addTransfer({ status: 'Completed', msgId: 'm1', originTxHash: '0xhash' });
    expect(useStore.getState().transfers).toHaveLength(2);

    // update valid index
    updateTransferStatus(0, 'Pending', { msgId: 'm0' });
    expect(useStore.getState().transfers[0]).toMatchObject({ status: 'Pending', msgId: 'm0' });

    // update invalid index: no change
    updateTransferStatus(5, 'Failed');
    expect(useStore.getState().transfers).toHaveLength(2);

    // fail only non-final
    failUnconfirmedTransfers();
    expect(useStore.getState().transfers[0].status).toBe('Failed'); // was Pending -> Failed
    expect(useStore.getState().transfers[1].status).toBe('Completed'); // final stays

    resetTransfers();
    expect(useStore.getState().transfers).toEqual([]);
  });

  it('toggles ui flags', () => {
    const { setTransferLoading, setIsSideBarOpen, setShowEnvSelectModal, setOriginChainName } =
      useStore.getState();

    setTransferLoading(true);
    setIsSideBarOpen(true);
    setShowEnvSelectModal(true);
    setOriginChainName('ChainX');

    const s = useStore.getState();
    expect(s.transferLoading).toBe(true);
    expect(s.isSideBarOpen).toBe(true);
    expect(s.showEnvSelectModal).toBe(true);
    expect(s.originChainName).toBe('ChainX');
  });

  it('setChainMetadataOverrides calls init, filters overrides, and updates state', async () => {
    const { setChainMetadataOverrides } = useStore.getState();
    await setChainMetadataOverrides({
      A: { chainId: 100 },
      // This should be filtered out by objFilter (!!metadata)
      B: undefined as any,
    });

    // The overrides passed down to assembleChainMetadata should have filtered out B
    expect(capture.lastChainMetadataOverridesArg).toEqual({ A: { chainId: 100 } });

    const s = useStore.getState();
    // multiProvider was rebuilt using the override
    expect(s.multiProvider?.cfg?.A?.chainId).toBe(100);
    // warpCore was rebuilt with tokens from mocked coreConfig
    expect(Array.isArray(s.warpCore?.tokens)).toBe(true);
    expect(s.tokensBySymbolChainMap.USDC).toBeDefined();
    // router addresses come from the coreConfig tokens
    expect(s.routerAddressesByChainMap.A).toBeInstanceOf(Set);
    expect(s.routerAddressesByChainMap.A.has('0xrouterA')).toBe(true);
    expect(s.routerAddressesByChainMap.B.has('0xrouterB')).toBe(true);
  });

  it('setWarpCoreConfigOverrides forwards overrides and updates state', async () => {
    const overrides = [{ tokens: [] }] as any;
    const { setWarpCoreConfigOverrides } = useStore.getState();
    await setWarpCoreConfigOverrides(overrides);

    // ensure we forwarded overrides to assembleWarpCoreConfig
    expect(capture.lastWarpCoreConfigOverridesArg).toBe(overrides);

    const s = useStore.getState();
    expect(Array.isArray(s.warpCore?.tokens)).toBe(true);
    expect(s.tokensBySymbolChainMap.USDC).toBeDefined();
    expect(s.routerAddressesByChainMap.A.has('0xrouterA')).toBe(true);
  });

  it('initWarpContext error path: shows toast and returns safe defaults', async () => {
    // Make assembleWarpCoreConfig throw inside initWarpContext
    const { assembleWarpCoreConfig } = await import('./../warpCore/warpCoreConfig');
    vi.mocked(assembleWarpCoreConfig as any).mockRejectedValueOnce(new Error('boom'));

    const { setWarpCoreConfigOverrides } = useStore.getState();
    await setWarpCoreConfigOverrides([{ any: 'thing' } as any]);

    expect(toastErrorSpy).toHaveBeenCalled();
    const s = useStore.getState();
    // Defaults from the catch branch
    expect(s.tokensBySymbolChainMap).toEqual({});
    expect(s.routerAddressesByChainMap).toEqual({});
    expect(Array.isArray(s.warpCore?.tokens)).toBe(true);
    expect(s.warpCore.tokens.length).toBe(0);
  });
});
