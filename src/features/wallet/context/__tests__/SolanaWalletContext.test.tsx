import { WalletAdapterNetwork, WalletError } from '@solana/wallet-adapter-base';
import * as web3 from '@solana/web3.js';
import { render, screen } from '@testing-library/react';
import { toast } from 'react-toastify';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { logger } from '../../../../utils/logger';
import { SolanaWalletContext } from './../SolanaWalletContext';

const connectionProviderMockState = vi.hoisted(() => ({
  lastEndpoint: null as string | null,
}));

const walletProviderMockState = vi.hoisted(() => ({
  latestOnError: null as ((error: WalletError) => void) | null,
  renderCount: 0,
  onErrorRefs: new Set<(error: WalletError) => void>(),
}));

const walletAdaptersMockState = vi.hoisted(() => ({
  phantom: 0,
  solflare: 0,
  backpack: 0,
  salmon: 0,
  trust: 0,
  ledger: 0,
  snap: 0,
}));

// Mock wallet adapters
vi.mock('@drift-labs/snap-wallet-adapter', () => ({
  SnapWalletAdapter: vi.fn(() => {
    walletAdaptersMockState.snap += 1;
    return { name: 'Snap Wallet' };
  }),
}));

vi.mock('@solana/wallet-adapter-wallets', () => ({
  BackpackWalletAdapter: vi.fn(() => {
    walletAdaptersMockState.backpack += 1;
    return { name: 'Backpack' };
  }),
  LedgerWalletAdapter: vi.fn(() => {
    walletAdaptersMockState.ledger += 1;
    return { name: 'Ledger' };
  }),
  PhantomWalletAdapter: vi.fn(() => {
    walletAdaptersMockState.phantom += 1;
    return { name: 'Phantom' };
  }),
  SalmonWalletAdapter: vi.fn(() => {
    walletAdaptersMockState.salmon += 1;
    return { name: 'Salmon' };
  }),
  SolflareWalletAdapter: vi.fn(() => {
    walletAdaptersMockState.solflare += 1;
    return { name: 'Solflare' };
  }),
  TrustWalletAdapter: vi.fn(() => {
    walletAdaptersMockState.trust += 1;
    return { name: 'Trust Wallet' };
  }),
}));

// Mock Solana providers
vi.mock('@solana/wallet-adapter-react', () => ({
  ConnectionProvider: ({ children, endpoint }: any) => {
    connectionProviderMockState.lastEndpoint = endpoint ?? null;
    return (
      <div data-testid="connection-provider" data-endpoint={endpoint}>
        {children}
      </div>
    );
  },
  WalletProvider: ({ children, wallets, onError, autoConnect }: any) => {
    walletProviderMockState.renderCount += 1;
    if (onError) {
      walletProviderMockState.latestOnError = onError;
      walletProviderMockState.onErrorRefs.add(onError);
    }

    return (
      <div
        data-testid="wallet-provider"
        data-wallets-count={wallets?.length || 0}
        data-auto-connect={String(autoConnect)}
        data-has-error-handler={String(!!onError)}
        data-render-count={String(walletProviderMockState.renderCount)}
      >
        {children}
      </div>
    );
  },
}));

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  WalletModalProvider: ({ children }: any) => (
    <div data-testid="wallet-modal-provider">{children}</div>
  ),
}));

vi.mock('@solana/web3.js', () => ({
  clusterApiUrl: vi.fn((network: WalletAdapterNetwork) => `https://${network}.solana.com`),
}));

vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('../../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('SolanaWalletContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectionProviderMockState.lastEndpoint = null;
    walletProviderMockState.renderCount = 0;
    walletProviderMockState.latestOnError = null;
    walletProviderMockState.onErrorRefs.clear();
    walletAdaptersMockState.phantom = 0;
    walletAdaptersMockState.solflare = 0;
    walletAdaptersMockState.backpack = 0;
    walletAdaptersMockState.salmon = 0;
    walletAdaptersMockState.trust = 0;
    walletAdaptersMockState.ledger = 0;
    walletAdaptersMockState.snap = 0;
  });

  it('should render children', () => {
    render(
      <SolanaWalletContext>
        <div data-testid="test-child">Test Child</div>
      </SolanaWalletContext>,
    );

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
  });

  it('should render all provider components', () => {
    render(
      <SolanaWalletContext>
        <div>Test</div>
      </SolanaWalletContext>,
    );

    expect(screen.getByTestId('connection-provider')).toBeInTheDocument();
    expect(screen.getByTestId('wallet-provider')).toBeInTheDocument();
    expect(screen.getByTestId('wallet-modal-provider')).toBeInTheDocument();
  });

  it('should use mainnet network by default', () => {
    render(
      <SolanaWalletContext>
        <div>Test</div>
      </SolanaWalletContext>,
    );

    expect(web3.clusterApiUrl).toHaveBeenCalledWith(WalletAdapterNetwork.Mainnet);
  });

  it('should set correct endpoint for ConnectionProvider', () => {
    render(
      <SolanaWalletContext>
        <div>Test</div>
      </SolanaWalletContext>,
    );

    const connectionProvider = screen.getByTestId('connection-provider');
    expect(connectionProvider).toHaveAttribute('data-endpoint', 'https://mainnet-beta.solana.com');
  });

  it('should initialize with 7 wallet adapters', () => {
    render(
      <SolanaWalletContext>
        <div>Test</div>
      </SolanaWalletContext>,
    );

    const walletProvider = screen.getByTestId('wallet-provider');
    expect(walletProvider).toHaveAttribute('data-wallets-count', '7');
  });

  it('should enable autoConnect on WalletProvider', () => {
    render(
      <SolanaWalletContext>
        <div>Test</div>
      </SolanaWalletContext>,
    );

    const walletProvider = screen.getByTestId('wallet-provider');
    expect(walletProvider).toHaveAttribute('data-auto-connect', 'true');
  });

  it('should provide error handler to WalletProvider', () => {
    render(
      <SolanaWalletContext>
        <div>Test</div>
      </SolanaWalletContext>,
    );

    const walletProvider = screen.getByTestId('wallet-provider');
    expect(walletProvider).toHaveAttribute('data-has-error-handler', 'true');
  });

  it('should create PhantomWalletAdapter', () => {
    render(
      <SolanaWalletContext>
        <div>Test</div>
      </SolanaWalletContext>,
    );

    expect(walletAdaptersMockState.phantom).toBe(1);
  });

  it('should create SolflareWalletAdapter', () => {
    render(
      <SolanaWalletContext>
        <div>Test</div>
      </SolanaWalletContext>,
    );

    expect(walletAdaptersMockState.solflare).toBe(1);
  });

  it('should create BackpackWalletAdapter', () => {
    render(
      <SolanaWalletContext>
        <div>Test</div>
      </SolanaWalletContext>,
    );

    expect(walletAdaptersMockState.backpack).toBe(1);
  });

  it('should create SalmonWalletAdapter', () => {
    render(
      <SolanaWalletContext>
        <div>Test</div>
      </SolanaWalletContext>,
    );

    expect(walletAdaptersMockState.salmon).toBe(1);
  });

  it('should create SnapWalletAdapter', () => {
    render(
      <SolanaWalletContext>
        <div>Test</div>
      </SolanaWalletContext>,
    );

    expect(walletAdaptersMockState.snap).toBe(1);
  });

  it('should create TrustWalletAdapter', () => {
    render(
      <SolanaWalletContext>
        <div>Test</div>
      </SolanaWalletContext>,
    );

    expect(walletAdaptersMockState.trust).toBe(1);
  });

  it('should create LedgerWalletAdapter', () => {
    render(
      <SolanaWalletContext>
        <div>Test</div>
      </SolanaWalletContext>,
    );

    expect(walletAdaptersMockState.ledger).toBe(1);
  });

  it('should memoize endpoint and not recreate on re-render', () => {
    const { rerender } = render(
      <SolanaWalletContext>
        <div>Test</div>
      </SolanaWalletContext>,
    );

    const initialCallCount = (web3.clusterApiUrl as Mock).mock.calls.length;

    rerender(
      <SolanaWalletContext>
        <div>Test Updated</div>
      </SolanaWalletContext>,
    );

    expect((web3.clusterApiUrl as Mock).mock.calls.length).toBe(initialCallCount);
  });

  it('should memoize wallets and not recreate on re-render', () => {
    const { rerender } = render(
      <SolanaWalletContext>
        <div>Test</div>
      </SolanaWalletContext>,
    );

    const initialCallCount = walletAdaptersMockState.phantom;

    rerender(
      <SolanaWalletContext>
        <div>Test Updated</div>
      </SolanaWalletContext>,
    );

    expect(walletAdaptersMockState.phantom).toBe(initialCallCount);
  });

  describe('Error Handling', () => {
    it('should handle wallet errors with logger', () => {
      render(
        <SolanaWalletContext>
          <div>Test</div>
        </SolanaWalletContext>,
      );

      // Simulate wallet error
      const mockError = new Error('Wallet connection failed') as WalletError;
      mockError.name = 'WalletConnectionError';
      walletProviderMockState.latestOnError?.(mockError);

      expect(logger.error).toHaveBeenCalledWith(
        'Error initializing Solana wallet provider',
        mockError,
      );
    });

    it('should display toast error on wallet error', () => {
      render(
        <SolanaWalletContext>
          <div>Test</div>
        </SolanaWalletContext>,
      );

      // Simulate wallet error
      const mockError = new Error('Wallet connection failed') as WalletError;
      mockError.name = 'WalletConnectionError';
      walletProviderMockState.latestOnError?.(mockError);

      expect(toast.error).toHaveBeenCalledWith('Error preparing Solana wallet');
    });

    it('should memoize onError callback', () => {
      const { rerender } = render(
        <SolanaWalletContext>
          <div>Test</div>
        </SolanaWalletContext>,
      );

      const initialSize = walletProviderMockState.onErrorRefs.size;
      const [initialOnError] = Array.from(walletProviderMockState.onErrorRefs);

      rerender(
        <SolanaWalletContext>
          <div>Test Updated</div>
        </SolanaWalletContext>,
      );

      expect(walletProviderMockState.onErrorRefs.size).toBe(initialSize);
      if (initialOnError) {
        expect(walletProviderMockState.onErrorRefs.has(initialOnError)).toBe(true);
      }
    });
  });

  describe('Provider Nesting', () => {
    it('should nest providers in correct order', () => {
      render(
        <SolanaWalletContext>
          <div data-testid="innermost-child">Inner</div>
        </SolanaWalletContext>,
      );

      const connectionProvider = screen.getByTestId('connection-provider');
      const walletProvider = screen.getByTestId('wallet-provider');
      const modalProvider = screen.getByTestId('wallet-modal-provider');
      const child = screen.getByTestId('innermost-child');

      // Check nesting order: Connection -> Wallet -> Modal -> Child
      expect(connectionProvider.contains(walletProvider)).toBe(true);
      expect(walletProvider.contains(modalProvider)).toBe(true);
      expect(modalProvider.contains(child)).toBe(true);
    });
  });

  describe('Network Configuration', () => {
    it('should use WalletAdapterNetwork.Mainnet constant', () => {
      render(
        <SolanaWalletContext>
          <div>Test</div>
        </SolanaWalletContext>,
      );

      // Verify the correct network constant is used
      expect(web3.clusterApiUrl).toHaveBeenCalledWith('mainnet-beta');
    });
  });
});
