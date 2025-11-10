import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenListModal } from '../TokenListModal';

// Mock dependencies
vi.mock('@hyperlane-xyz/widgets', () => ({
  Modal: ({ children, isOpen, close }: any) =>
    isOpen ? (
      <div data-testid="modal">
        <button onClick={close} data-testid="modal-close">
          Close
        </button>
        {children}
      </div>
    ) : null,
  SearchIcon: () => <div data-testid="search-icon" />,
}));

vi.mock('../../components/icons/TokenIcon', () => ({
  TokenIcon: ({ token }: any) => <div data-testid="token-icon">{token.symbol}</div>,
}));

vi.mock('../../components/icons/ChainLogo', () => ({
  ChainLogo: ({ chainName }: any) => <div data-testid="chain-logo">{chainName}</div>,
}));

vi.mock('./hooks', () => ({
  useWarpCore: () => ({
    tokens: [
      {
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
        chainName: 'test-chain',
        addressOrDenom: '0x123',
        collateralAddressOrDenom: '0x456',
        isMultiChainToken: () => true,
      },
      {
        name: 'Another Token',
        symbol: 'ANOTHER',
        decimals: 6,
        chainName: 'another-chain',
        addressOrDenom: '0x789',
        isMultiChainToken: () => true,
      },
    ],
    getTokensForRoute: vi.fn(() => []),
  }),
}));

vi.mock('../chains/hooks', () => ({
  useMultiProvider: () => ({
    getChainMetadata: () => ({
      name: 'Test Chain',
      displayName: 'Test Chain Display',
    }),
  }),
}));

vi.mock('../store', () => ({
  useStore: vi.fn(() => ({
    tokensBySymbolChainMap: {
      TEST: {
        tokenInformation: {
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 18,
        },
        chains: {
          'test-chain': {
            token: {
              name: 'Test Token',
              symbol: 'TEST',
              decimals: 18,
              chainName: 'test-chain',
              addressOrDenom: '0x123',
            },
            metadata: {
              name: 'Test Chain',
              displayName: 'Test Chain',
            },
          },
        },
      },
    },
  })),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} data-testid="next-image" {...props} />
  ),
}));

describe('TokenListModal', () => {
  const defaultProps = {
    isOpen: true,
    close: vi.fn(),
    onSelect: vi.fn(),
    origin: 'ethereum',
    destination: 'polygon',
    onSelectUnsupportedRoute: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Behavior', () => {
    it('renders when isOpen is true', () => {
      render(<TokenListModal {...defaultProps} />);
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<TokenListModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('calls close handler when modal is closed', () => {
      render(<TokenListModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId('modal-close'));
      expect(defaultProps.close).toHaveBeenCalled();
    });
  });

  describe('SearchBar', () => {
    it('renders search input with correct placeholder', () => {
      render(<TokenListModal {...defaultProps} />);
      expect(screen.getByPlaceholderText('Token name, symbol, or address')).toBeInTheDocument();
    });

    it('updates search value on input change', async () => {
      render(<TokenListModal {...defaultProps} />);
      const searchInput = screen.getByTestId('input-token-search');
      await userEvent.type(searchInput, 'TEST');
      expect(searchInput).toHaveValue('TEST');
    });
  });

  // describe('TokenList', () => {
  //   it('displays token list items', () => {
  //     render(<TokenListModal {...defaultProps} />);
  //     expect(screen.getByText('TEST')).toBeInTheDocument();
  //     expect(screen.getByText('ANOTHER')).toBeInTheDocument();
  //   });

  //   it('shows token details', () => {
  //     render(<TokenListModal {...defaultProps} />);
  //     expect(screen.getByText('Decimals: 18')).toBeInTheDocument();
  //     expect(screen.getByText('Chain: Test Chain Display')).toBeInTheDocument();
  //   });

  //   it('filters tokens based on search query', async () => {
  //     render(<TokenListModal {...defaultProps} />);
  //     const searchInput = screen.getByTestId('input-token-search');
  //     await userEvent.type(searchInput, 'TEST');

  //     await waitFor(() => {
  //       expect(screen.getByText('TEST')).toBeInTheDocument();
  //       expect(screen.queryByText('ANOTHER')).not.toBeInTheDocument();
  //     });
  //   });

  //   it('displays "No tokens found" message when no tokens match search', async () => {
  //     render(<TokenListModal {...defaultProps} />);
  //     const searchInput = screen.getByTestId('input-token-search');
  //     await userEvent.type(searchInput, 'NONEXISTENT');

  //     expect(screen.getByText('No tokens found')).toBeInTheDocument();
  //     expect(
  //       screen.getByText('Try a different destination chain or search query'),
  //     ).toBeInTheDocument();
  //   });
  // });

  // describe('UnsupportedRouteTokenList', () => {
  //   it('renders unsupported route tokens', () => {
  //     render(<TokenListModal {...defaultProps} />);
  //     const unsupportedTokens = screen.getAllByTestId('token-icon');
  //     expect(unsupportedTokens.length).toBeGreaterThan(0);
  //   });

  //   it('expands chain list when clicking on unsupported token', async () => {
  //     render(<TokenListModal {...defaultProps} />);
  //     const unsupportedToken = screen.getAllByText('TEST')[0];
  //     await userEvent.click(unsupportedToken);

  //     expect(screen.getByText('Test Chain')).toBeInTheDocument();
  //   });

  //   it('calls onSelectUnsupportedRoute when selecting a chain', async () => {
  //     render(<TokenListModal {...defaultProps} />);

  //     // First click to expand the token's chain list
  //     const unsupportedToken = screen.getAllByText('TEST')[0];
  //     await userEvent.click(unsupportedToken);

  //     // Then click on a chain option
  //     const chainOption = screen.getByText('Test Chain');
  //     await userEvent.click(chainOption);

  //     expect(defaultProps.onSelectUnsupportedRoute).toHaveBeenCalled();
  //     expect(defaultProps.close).toHaveBeenCalled();
  //   });
  // });

  // describe('Integration Tests', () => {
  //   it('handles complete token selection flow', async () => {
  //     render(<TokenListModal {...defaultProps} />);

  //     // Search for a token
  //     const searchInput = screen.getByTestId('input-token-search');
  //     await userEvent.type(searchInput, 'TEST');

  //     // Select the token
  //     const tokenButton = screen.getAllByText('TEST')[0];
  //     await userEvent.click(tokenButton);

  //     expect(defaultProps.onSelect).toHaveBeenCalled();
  //     expect(defaultProps.close).toHaveBeenCalled();
  //   });

  //   it('clears search when closing modal', async () => {
  //     render(<TokenListModal {...defaultProps} />);

  //     // Type in search
  //     const searchInput = screen.getByTestId('input-token-search');
  //     await userEvent.type(searchInput, 'TEST');

  //     // Close modal
  //     fireEvent.click(screen.getByTestId('modal-close'));

  //     // Reopen modal
  //     render(<TokenListModal {...defaultProps} />);

  //     // Check if search is cleared
  //     expect(screen.getByTestId('input-token-search')).toHaveValue('');
  //   });
  // });
});
