import { ProtocolType } from '@hyperlane-xyz/utils';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as chainsHooks from '../../../chains/hooks';
import * as tokensHooks from '../../../tokens/hooks';
import { EvmWalletContext } from './../EvmWalletContext';

const widgetsMockState = vi.hoisted(() => ({
  getWagmiChainConfigsArgs: [] as any[],
}));

const rainbowKitMockState = vi.hoisted(() => ({
  connectorsCallArgs: [] as any[][],
  lightThemeConfigs: [] as any[],
  providerProps: [] as Array<{ initialChain: unknown; theme: unknown }>,
}));

const wagmiMockState = vi.hoisted(() => ({
  providerConfigs: [] as any[],
  createConfigArgs: [] as any[],
}));

const viemMockState = vi.hoisted(() => ({
  httpUrls: [] as string[],
  fallbackArgs: [] as any[],
}));

// Mock constants
vi.mock('../../../../consts/app', () => ({
  APP_NAME: 'Test App',
}));

vi.mock('../../../../consts/config', () => ({
  config: {
    walletConnectProjectId: 'test-project-id',
  },
}));

vi.mock('../../../../styles/Color', () => ({
  Color: {
    primary: {
      '500': '#007bff',
    },
  },
}));

// Mock Hyperlane SDK
vi.mock('@hyperlane-xyz/widgets', () => ({
  getWagmiChainConfigs: (multiProvider: unknown) => {
    widgetsMockState.getWagmiChainConfigsArgs.push(multiProvider);
    return [
      {
        id: 1,
        name: 'Ethereum',
        rpcUrls: { default: { http: ['https://eth-mainnet.example.com'] } },
      },
      {
        id: 137,
        name: 'Polygon',
        rpcUrls: { default: { http: ['https://polygon-rpc.example.com'] } },
      },
    ];
  },
}));

// Mock RainbowKit
vi.mock('@rainbow-me/rainbowkit', () => ({
  RainbowKitProvider: ({ children, theme, initialChain }: any) => {
    rainbowKitMockState.providerProps.push({ theme, initialChain });
    return (
      <div
        data-testid="rainbowkit-provider"
        data-initial-chain={String(initialChain ?? '')}
        data-has-theme={String(!!theme)}
      >
        {children}
      </div>
    );
  },
  connectorsForWallets: (...args: any[]) => {
    rainbowKitMockState.connectorsCallArgs.push(args);
    return ['mock-connector'];
  },
  lightTheme: (config: any) => {
    rainbowKitMockState.lightThemeConfigs.push(config);
    return { type: 'light', ...config };
  },
  getDefaultConfig: vi.fn(),
}));

vi.mock('@rainbow-me/rainbowkit/wallets', () => ({
  argentWallet: { id: 'argent' },
  binanceWallet: { id: 'binance' },
  coinbaseWallet: { id: 'coinbase' },
  injectedWallet: { id: 'injected' },
  ledgerWallet: { id: 'ledger' },
  metaMaskWallet: { id: 'metamask' },
  rainbowWallet: { id: 'rainbow' },
  trustWallet: { id: 'trust' },
  walletConnectWallet: { id: 'walletconnect' },
}));

// Mock Wagmi
vi.mock('wagmi', () => ({
  WagmiProvider: ({ children, config }: any) => {
    wagmiMockState.providerConfigs.push(config);
    return (
      <div data-testid="wagmi-provider" data-has-config={String(!!config)}>
        {children}
      </div>
    );
  },
  createConfig: (config: any) => {
    wagmiMockState.createConfigArgs.push(config);
    return {
      chains: config.chains,
      connectors: config.connectors,
      client: config.client,
    };
  },
}));

vi.mock('viem', () => ({
  createClient: () => ({ type: 'mock-client' }),
  fallback: (transports: unknown) => {
    viemMockState.fallbackArgs.push(transports);
    return { type: 'fallback', transports };
  },
  http: (url: string) => {
    viemMockState.httpUrls.push(url);
    return { type: 'http', url };
  },
}));

// Mock hooks
vi.mock('../../../chains/hooks', () => ({
  useMultiProvider: vi.fn(),
}));

vi.mock('../../../tokens/hooks', () => ({
  useWarpCore: vi.fn(),
}));

describe('EvmWalletContext', () => {
  const mockMultiProvider = {
    tryGetChainMetadata: vi.fn(),
  };

  const mockWarpCore = {
    tokens: [] as any[],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMultiProvider.tryGetChainMetadata.mockReset();
    mockWarpCore.tokens = [];
    widgetsMockState.getWagmiChainConfigsArgs.length = 0;
    rainbowKitMockState.connectorsCallArgs.length = 0;
    rainbowKitMockState.lightThemeConfigs.length = 0;
    rainbowKitMockState.providerProps.length = 0;
    wagmiMockState.providerConfigs.length = 0;
    wagmiMockState.createConfigArgs.length = 0;
    viemMockState.httpUrls.length = 0;
    viemMockState.fallbackArgs.length = 0;
    vi.mocked(chainsHooks.useMultiProvider).mockReturnValue(mockMultiProvider as any);
    vi.mocked(tokensHooks.useWarpCore).mockReturnValue(mockWarpCore as any);
  });

  it('should render children', () => {
    render(
      <EvmWalletContext>
        <div data-testid="test-child">Test Child</div>
      </EvmWalletContext>,
    );

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
  });

  it('should render WagmiProvider and RainbowKitProvider', () => {
    render(
      <EvmWalletContext>
        <div>Test</div>
      </EvmWalletContext>,
    );

    expect(screen.getByTestId('wagmi-provider')).toBeInTheDocument();
    expect(screen.getByTestId('rainbowkit-provider')).toBeInTheDocument();
  });

  it('should nest providers in correct order', () => {
    render(
      <EvmWalletContext>
        <div data-testid="innermost-child">Inner</div>
      </EvmWalletContext>,
    );

    const wagmiProvider = screen.getByTestId('wagmi-provider');
    const rainbowkitProvider = screen.getByTestId('rainbowkit-provider');
    const child = screen.getByTestId('innermost-child');

    expect(wagmiProvider.contains(rainbowkitProvider)).toBe(true);
    expect(rainbowkitProvider.contains(child)).toBe(true);
  });

  it('should initialize wagmi config with chains from multiProvider', () => {
    render(
      <EvmWalletContext>
        <div>Test</div>
      </EvmWalletContext>,
    );

    expect(widgetsMockState.getWagmiChainConfigsArgs.at(-1)).toBe(mockMultiProvider);
  });

  it('should create wagmi config with connectors', () => {
    render(
      <EvmWalletContext>
        <div>Test</div>
      </EvmWalletContext>,
    );

    const connectorsArgs = rainbowKitMockState.connectorsCallArgs[0];
    expect(connectorsArgs?.[1]).toMatchObject({
      appName: 'Test App',
      projectId: 'test-project-id',
    });
    expect(wagmiMockState.createConfigArgs.length).toBeGreaterThan(0);
    expect(wagmiMockState.createConfigArgs[0].connectors).toEqual(['mock-connector']);
  });

  it('should configure recommended wallets correctly', () => {
    render(
      <EvmWalletContext>
        <div>Test</div>
      </EvmWalletContext>,
    );

    const connectorsArgs = rainbowKitMockState.connectorsCallArgs[0];
    const recommendedGroup = connectorsArgs?.[0]?.[0];
    expect(recommendedGroup.groupName).toBe('Recommended');
    expect(recommendedGroup.wallets).toHaveLength(4);
  });

  it('should configure more wallets correctly', () => {
    render(
      <EvmWalletContext>
        <div>Test</div>
      </EvmWalletContext>,
    );

    const connectorsArgs = rainbowKitMockState.connectorsCallArgs[0];
    const moreGroup = connectorsArgs?.[0]?.[1];
    expect(moreGroup.groupName).toBe('More');
    expect(moreGroup.wallets).toHaveLength(5);
  });

  it('should apply light theme with custom colors', () => {
    render(
      <EvmWalletContext>
        <div>Test</div>
      </EvmWalletContext>,
    );

    expect(rainbowKitMockState.lightThemeConfigs[0]).toEqual({
      accentColor: '#007bff',
      borderRadius: 'small',
      fontStack: 'system',
    });
  });

  it('should set initialChain from first EVM token', () => {
    const mockTokens = [
      { chainName: 'ethereum', protocol: ProtocolType.Ethereum },
      { chainName: 'polygon', protocol: ProtocolType.Ethereum },
    ];

    mockWarpCore.tokens = mockTokens;
    mockMultiProvider.tryGetChainMetadata.mockReturnValue({ chainId: 1 });

    render(
      <EvmWalletContext>
        <div>Test</div>
      </EvmWalletContext>,
    );

    const rainbowkitProvider = screen.getByTestId('rainbowkit-provider');
    expect(rainbowkitProvider).toHaveAttribute('data-initial-chain', '1');
    expect(mockMultiProvider.tryGetChainMetadata).toHaveBeenCalledWith('ethereum');
  });

  it('should handle no EVM tokens gracefully', () => {
    const mockTokens = [{ chainName: 'solana', protocol: ProtocolType.Sealevel }];

    mockWarpCore.tokens = mockTokens;

    render(
      <EvmWalletContext>
        <div>Test</div>
      </EvmWalletContext>,
    );

    // Should not crash
    expect(screen.getByTestId('rainbowkit-provider')).toBeInTheDocument();
  });

  it('should memoize wagmi config based on multiProvider', () => {
    const { rerender } = render(
      <EvmWalletContext>
        <div>Test</div>
      </EvmWalletContext>,
    );

    const initialCallCount = wagmiMockState.createConfigArgs.length;

    // Re-render with same multiProvider
    rerender(
      <EvmWalletContext>
        <div>Updated</div>
      </EvmWalletContext>,
    );

    // Should not recreate config
    expect(wagmiMockState.createConfigArgs.length).toBe(initialCallCount);
  });

  it('should recreate wagmi config when multiProvider changes', () => {
    const { rerender } = render(
      <EvmWalletContext>
        <div>Test</div>
      </EvmWalletContext>,
    );

    const initialCallCount = wagmiMockState.createConfigArgs.length;

    // Change multiProvider
    const newMultiProvider = { ...mockMultiProvider };
    vi.mocked(chainsHooks.useMultiProvider).mockReturnValue(newMultiProvider as any);

    rerender(
      <EvmWalletContext>
        <div>Updated</div>
      </EvmWalletContext>,
    );

    // Should recreate config
    expect(wagmiMockState.createConfigArgs.length).toBeGreaterThan(initialCallCount);
  });

  it('should recalculate initialChain when warpCore changes', () => {
    const mockTokens1 = [{ chainName: 'ethereum', protocol: ProtocolType.Ethereum }];
    mockWarpCore.tokens = mockTokens1;
    mockMultiProvider.tryGetChainMetadata.mockReturnValue({ chainId: 1 });

    const { rerender } = render(
      <EvmWalletContext>
        <div>Test</div>
      </EvmWalletContext>,
    );

    let rainbowkitProvider = screen.getByTestId('rainbowkit-provider');
    expect(rainbowkitProvider).toHaveAttribute('data-initial-chain', '1');

    // Change warpCore tokens
    const newWarpCore = {
      tokens: [{ chainName: 'polygon', protocol: ProtocolType.Ethereum }],
    };
    mockMultiProvider.tryGetChainMetadata.mockReturnValue({ chainId: 137 });
    vi.mocked(tokensHooks.useWarpCore).mockReturnValue(newWarpCore as any);

    rerender(
      <EvmWalletContext>
        <div>Updated</div>
      </EvmWalletContext>,
    );

    rainbowkitProvider = screen.getByTestId('rainbowkit-provider');
    expect(rainbowkitProvider).toHaveAttribute('data-initial-chain', '137');
  });

  describe('Fallback Transport Configuration', () => {
    it('should create fallback transport with multiple RPC URLs', () => {
      render(
        <EvmWalletContext>
          <div>Test</div>
        </EvmWalletContext>,
      );

      // Get the client function from createConfig
      const clientFn = wagmiMockState.createConfigArgs[0].client;
      const mockChain = {
        rpcUrls: {
          default: {
            http: ['https://rpc1.example.com', 'https://rpc2.example.com'],
          },
        },
      };

      clientFn({ chain: mockChain });

      expect(viemMockState.httpUrls).toEqual([
        'https://rpc1.example.com',
        'https://rpc2.example.com',
      ]);
      expect(Array.isArray(viemMockState.fallbackArgs[0])).toBe(true);
      expect(viemMockState.fallbackArgs[0]).toHaveLength(2);
    });
  });
});
