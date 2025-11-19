import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as chainsHooks from '../../../chains/hooks';
import { CosmosWalletContext } from './../CosmosWalletContext';

const chainProviderMockState = vi.hoisted(() => ({
  propsHistory: [] as any[],
}));

const multiProviderMockState = vi.hoisted(() => ({
  instances: [] as Array<{ metadata: any; getChains: any }>,
}));

const cosmosKitMockState = vi.hoisted(() => ({
  getConfigArgs: [] as any[],
}));

// Mock constants
vi.mock('../../../../consts/app', () => ({
  APP_NAME: 'Test Cosmos App',
  APP_DESCRIPTION: 'Test Description',
  APP_URL: 'https://test.com',
}));

vi.mock('../../../../consts/config', () => ({
  config: {
    walletConnectProjectId: 'test-cosmos-project-id',
    useOnlineRegistry: false,
    registryUrl: 'https://registry.test',
    registryBranch: 'main',
    registryProxyUrl: 'https://proxy.test',
  },
}));

// Mock Hyperlane
vi.mock('@hyperlane-xyz/registry', () => {
  const cosmoshub = {
    chainId: 'cosmoshub-4',
    name: 'Cosmos Hub',
  };

  class GithubRegistry {
    constructor(public options: any) {}
  }

  return { cosmoshub, GithubRegistry };
});

vi.mock('@hyperlane-xyz/sdk', () => {
  class MultiProtocolProvider {
    metadata: any;
    getChains: ReturnType<typeof vi.fn>;

    constructor(metadata: any) {
      this.metadata = metadata;
      this.getChains = vi.fn(() => Object.keys(metadata || {}));
      multiProviderMockState.instances.push(this);
    }
  }

  class WarpCore {
    constructor(
      public provider: any,
      public tokens: any[],
    ) {
      this.provider = provider;
      this.tokens = tokens;
    }
  }

  const WarpCoreConfigSchema = {
    safeParse: (value: unknown) => ({ success: true, data: value }),
  };

  return { MultiProtocolProvider, WarpCore, WarpCoreConfigSchema };
});

vi.mock('@hyperlane-xyz/widgets', () => ({
  getCosmosKitChainConfigs: vi.fn((multiProvider) => {
    cosmosKitMockState.getConfigArgs.push(multiProvider);
    return {
      chains: [
        { chainId: 'cosmoshub-4', chainName: 'cosmoshub' },
        { chainId: 'osmosis-1', chainName: 'osmosis' },
      ],
      assets: [
        { chainName: 'cosmoshub', assets: [] },
        { chainName: 'osmosis', assets: [] },
      ],
    };
  }),
}));

// Mock Cosmos Kit wallets
vi.mock('@cosmos-kit/keplr', () => ({
  wallets: [
    { walletName: 'keplr-extension', id: 'keplr' },
    { walletName: 'keplr-mobile', id: 'keplr-mobile' },
  ],
}));

vi.mock('@cosmos-kit/cosmostation', () => ({
  wallets: [
    { walletName: 'cosmostation-extension', id: 'cosmostation' },
    { walletName: 'cosmostation-mobile', id: 'cosmostation-mobile' },
  ],
}));

vi.mock('@cosmos-kit/leap', () => ({
  wallets: [
    { walletName: 'leap-extension', id: 'leap' },
    { walletName: 'leap-metamask-cosmos-snap', id: 'leap-snap' },
    { walletName: 'leap-mobile', id: 'leap-mobile' },
  ],
}));

// Mock Chakra UI
vi.mock('@chakra-ui/react', () => ({
  ChakraProvider: ({ children, theme }: any) => (
    <div data-testid="chakra-provider" data-has-theme={!!theme}>
      {children}
    </div>
  ),
  extendTheme: vi.fn((config) => ({ ...config, type: 'extended-theme' })),
}));

// Mock Cosmos Kit ChainProvider
vi.mock('@cosmos-kit/react', () => {
  const ChainProvider = vi.fn((props: any) => {
    chainProviderMockState.propsHistory.push(props);
    const {
      children,
      chains,
      assetLists,
      wallets,
      walletConnectOptions,
      signerOptions,
      modalTheme,
    } = props;

    return (
      <div
        data-testid="chain-provider"
        data-chains-count={chains?.length || 0}
        data-assets-count={assetLists?.length || 0}
        data-wallets-count={wallets?.length || 0}
        data-has-wallet-connect={String(!!walletConnectOptions)}
        data-has-signer-options={String(!!signerOptions)}
        data-modal-theme={modalTheme?.defaultTheme}
      >
        {children}
      </div>
    );
  });

  return { ChainProvider };
});

// Mock hooks
vi.mock('../../../chains/hooks', () => ({
  useMultiProvider: vi.fn(),
}));

describe('CosmosWalletContext', () => {
  const mockMultiProvider = {
    metadata: {
      ethereum: { chainId: 1, name: 'Ethereum' },
      osmosis: { chainId: 'osmosis-1', name: 'Osmosis' },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    chainProviderMockState.propsHistory.length = 0;
    multiProviderMockState.instances.length = 0;
    cosmosKitMockState.getConfigArgs.length = 0;
    vi.mocked(chainsHooks.useMultiProvider).mockReturnValue(mockMultiProvider as any);
  });

  it('should render children', () => {
    render(
      <CosmosWalletContext>
        <div data-testid="test-child">Test Child</div>
      </CosmosWalletContext>,
    );

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
  });

  it('should render ChakraProvider and ChainProvider', () => {
    render(
      <CosmosWalletContext>
        <div>Test</div>
      </CosmosWalletContext>,
    );

    expect(screen.getByTestId('chakra-provider')).toBeInTheDocument();
    expect(screen.getByTestId('chain-provider')).toBeInTheDocument();
  });

  it('should nest providers in correct order', () => {
    render(
      <CosmosWalletContext>
        <div data-testid="innermost-child">Inner</div>
      </CosmosWalletContext>,
    );

    const chakraProvider = screen.getByTestId('chakra-provider');
    const chainProvider = screen.getByTestId('chain-provider');
    const child = screen.getByTestId('innermost-child');

    expect(chakraProvider.contains(chainProvider)).toBe(true);
    expect(chainProvider.contains(child)).toBe(true);
  });

  it.skip('should apply custom Chakra theme', () => {
    const { extendTheme } = require('@chakra-ui/react');

    render(
      <CosmosWalletContext>
        <div>Test</div>
      </CosmosWalletContext>,
    );

    expect(extendTheme).toHaveBeenCalledWith({
      fonts: {
        heading: `'Neue Haas Grotesk', 'Helvetica', 'sans-serif'`,
        body: `'Neue Haas Grotesk', 'Helvetica', 'sans-serif'`,
      },
    });

    const chakraProvider = screen.getByTestId('chakra-provider');
    expect(chakraProvider).toHaveAttribute('data-has-theme', 'true');
  });

  it('should configure chains from multiProvider', () => {
    render(
      <CosmosWalletContext>
        <div>Test</div>
      </CosmosWalletContext>,
    );

    const chainProvider = screen.getByTestId('chain-provider');
    expect(chainProvider).toHaveAttribute('data-chains-count', '2');
  });

  it('should configure assets from multiProvider', () => {
    render(
      <CosmosWalletContext>
        <div>Test</div>
      </CosmosWalletContext>,
    );

    const chainProvider = screen.getByTestId('chain-provider');
    expect(chainProvider).toHaveAttribute('data-assets-count', '2');
  });

  it('should filter out Leap snap wallet', () => {
    render(
      <CosmosWalletContext>
        <div>Test</div>
      </CosmosWalletContext>,
    );

    const chainProvider = screen.getByTestId('chain-provider');
    // Keplr (2) + Cosmostation (2) + Leap (3 - 1 snap) = 6 wallets
    expect(chainProvider).toHaveAttribute('data-wallets-count', '6');
  });

  it('should configure WalletConnect options', () => {
    render(
      <CosmosWalletContext>
        <div>Test</div>
      </CosmosWalletContext>,
    );

    const chainProvider = screen.getByTestId('chain-provider');
    expect(chainProvider).toHaveAttribute('data-has-wallet-connect', 'true');
  });

  it('should configure signer options for gas prices', () => {
    render(
      <CosmosWalletContext>
        <div>Test</div>
      </CosmosWalletContext>,
    );

    const chainProvider = screen.getByTestId('chain-provider');
    expect(chainProvider).toHaveAttribute('data-has-signer-options', 'true');
  });

  it('should set light modal theme', () => {
    render(
      <CosmosWalletContext>
        <div>Test</div>
      </CosmosWalletContext>,
    );

    const chainProvider = screen.getByTestId('chain-provider');
    expect(chainProvider).toHaveAttribute('data-modal-theme', 'light');
  });

  it('should include cosmoshub in MultiProtocolProvider', () => {
    render(
      <CosmosWalletContext>
        <div>Test</div>
      </CosmosWalletContext>,
    );

    const lastInstance = multiProviderMockState.instances.at(-1);
    expect(lastInstance?.metadata).toMatchObject({
      ...mockMultiProvider.metadata,
      cosmoshub: {
        chainId: 'cosmoshub-4',
        name: 'Cosmos Hub',
      },
    });
  });

  it('should memoize chains and assets based on chainMetadata', () => {
    const { rerender } = render(
      <CosmosWalletContext>
        <div>Test</div>
      </CosmosWalletContext>,
    );

    const initialCallCount = cosmosKitMockState.getConfigArgs.length;

    // Re-render with same metadata
    rerender(
      <CosmosWalletContext>
        <div>Updated</div>
      </CosmosWalletContext>,
    );

    // Should not recreate chains/assets
    expect(cosmosKitMockState.getConfigArgs.length).toBe(initialCallCount);
  });

  it('should recreate chains when chainMetadata changes', () => {
    const { rerender } = render(
      <CosmosWalletContext>
        <div>Test</div>
      </CosmosWalletContext>,
    );

    const initialCallCount = cosmosKitMockState.getConfigArgs.length;

    // Change metadata
    const newMultiProvider = {
      metadata: {
        ethereum: { chainId: 1, name: 'Ethereum' },
        celestia: { chainId: 'celestia-1', name: 'Celestia' },
      },
    };
    vi.mocked(chainsHooks.useMultiProvider).mockReturnValue(newMultiProvider as any);

    rerender(
      <CosmosWalletContext>
        <div>Updated</div>
      </CosmosWalletContext>,
    );

    // Should recreate chains/assets
    expect(cosmosKitMockState.getConfigArgs.length).toBeGreaterThan(initialCallCount);
  });

  describe('Signer Options Configuration', () => {
    it('should configure CosmWasm gas price', () => {
      render(
        <CosmosWalletContext>
          <div>Test</div>
        </CosmosWalletContext>,
      );

      const signerOptions = chainProviderMockState.propsHistory.at(-1)?.signerOptions;
      const cosmwasmConfig = signerOptions.signingCosmwasm();

      expect(cosmwasmConfig).toHaveProperty('gasPrice');
      expect(cosmwasmConfig.gasPrice).toBeInstanceOf(Object);
    });

    it('should configure Stargate gas price', () => {
      render(
        <CosmosWalletContext>
          <div>Test</div>
        </CosmosWalletContext>,
      );

      const signerOptions = chainProviderMockState.propsHistory.at(-1)?.signerOptions;
      const stargateConfig = signerOptions.signingStargate();

      expect(stargateConfig).toHaveProperty('gasPrice');
      expect(stargateConfig.gasPrice).toBeInstanceOf(Object);
    });
  });

  describe('WalletConnect Configuration', () => {
    it('should configure WalletConnect with project ID', () => {
      render(
        <CosmosWalletContext>
          <div>Test</div>
        </CosmosWalletContext>,
      );

      const walletConnectOptions = chainProviderMockState.propsHistory.at(-1)?.walletConnectOptions;
      expect(walletConnectOptions.signClient.projectId).toBe('test-cosmos-project-id');
    });

    it('should configure WalletConnect metadata', () => {
      render(
        <CosmosWalletContext>
          <div>Test</div>
        </CosmosWalletContext>,
      );

      const walletConnectOptions = chainProviderMockState.propsHistory.at(-1)?.walletConnectOptions;
      const metadata = walletConnectOptions.signClient.metadata;

      expect(metadata).toEqual({
        name: 'Test Cosmos App',
        description: 'Test Description',
        url: 'https://test.com',
        icons: [],
      });
    });
  });

  describe.skip('Wallet Configuration', () => {
    it('should include Keplr wallets', () => {
      const { wallets: keplrWallets } = require('@cosmos-kit/keplr');

      render(
        <CosmosWalletContext>
          <div>Test</div>
        </CosmosWalletContext>,
      );

      const wallets = chainProviderMockState.propsHistory.at(-1)?.wallets;
      expect(wallets).toEqual(expect.arrayContaining(keplrWallets));
    });

    it('should include Cosmostation wallets', () => {
      const { wallets: cosmostationWallets } = require('@cosmos-kit/cosmostation');

      render(
        <CosmosWalletContext>
          <div>Test</div>
        </CosmosWalletContext>,
      );

      const wallets = chainProviderMockState.propsHistory.at(-1)?.wallets;
      expect(wallets).toEqual(expect.arrayContaining(cosmostationWallets));
    });

    it('should exclude Leap snap wallet', () => {
      render(
        <CosmosWalletContext>
          <div>Test</div>
        </CosmosWalletContext>,
      );

      const wallets = chainProviderMockState.propsHistory.at(-1)?.wallets;
      const hasSnapWallet = wallets.some((w: any) => w.walletName.includes('snap'));
      expect(hasSnapWallet).toBe(false);
    });

    it('should include non-snap Leap wallets', () => {
      render(
        <CosmosWalletContext>
          <div>Test</div>
        </CosmosWalletContext>,
      );

      const wallets = chainProviderMockState.propsHistory.at(-1)?.wallets;
      const leapExtension = wallets.find((w: any) => w.id === 'leap');
      const leapMobile = wallets.find((w: any) => w.id === 'leap-mobile');

      expect(leapExtension).toBeDefined();
      expect(leapMobile).toBeDefined();
    });
  });
});
