import { IToken } from '@hyperlane-xyz/sdk';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenSelectField } from '../TokenSelectField';

// Mock dependencies
vi.mock('@hyperlane-xyz/widgets', () => ({
  ChevronIcon: ({ width, height, direction, color }: any) => (
    <svg
      data-testid="chevron-icon"
      data-direction={direction}
      width={width}
      height={height}
      style={{ color }}
    >
      <path d="M1 1h1v1h-1z" />
    </svg>
  ),
}));

vi.mock('../../../components/icons/TokenIcon', () => ({
  TokenIcon: ({ token }: any) => <div data-testid="token-icon">{token.symbol}</div>,
}));

vi.mock('../TokenListModal', () => ({
  TokenListModal: ({ isOpen, close, onSelect, onSelectUnsupportedRoute }: any) =>
    isOpen ? (
      <div data-testid="token-modal">
        <button onClick={close} data-testid="modal-close">
          Close
        </button>
        <button onClick={() => onSelect(mockTokens[0])} data-testid="select-token">
          Select Token
        </button>
        <button
          onClick={() => onSelectUnsupportedRoute(mockTokens[1], 'test-chain')}
          data-testid="select-unsupported"
        >
          Select Unsupported
        </button>
      </div>
    ) : null,
}));

const mockTokens = [
  {
    name: 'Test Token',
    symbol: 'TEST',
    decimals: 18,
    chainName: 'test-chain',
    addressOrDenom: '0xtest',
    isNft: () => false,
  },
  {
    name: 'Unsupported Token',
    symbol: 'UNSUPPORTED',
    decimals: 18,
    chainName: 'unsupported-chain',
    addressOrDenom: '0xunsupported',
    isNft: () => true,
    connections: [
      {
        token: {
          chainName: 'destination-chain',
        },
      },
    ],
  },
] as IToken[];

// Using hoisted mock for useWarpCore to allow access in tests
const mockGetTokensForRoute = vi.fn(() => [mockTokens[0]]);
const useWarpCoreMock = vi.fn(() => ({
  getTokensForRoute: mockGetTokensForRoute,
  tokens: mockTokens,
}));

vi.mock('../hooks', () => ({
  useWarpCore: () => useWarpCoreMock(),
  getIndexForToken: vi.fn(() => 0),
  getTokenByIndex: vi.fn((warpCore, index) => (index === 0 ? mockTokens[0] : undefined)),
  getTokenIndexFromChains: vi.fn(() => 1),
}));

vi.mock('../../../utils/queryParams', () => ({
  updateQueryParam: vi.fn(),
  updateQueryParams: vi.fn(),
}));

const FormWrapper = ({ children, initialValues = {} }: any) => (
  <Formik
    initialValues={{
      origin: 'origin-chain',
      destination: 'destination-chain',
      tokenIndex: undefined,
      ...initialValues,
    }}
    onSubmit={() => {}}
  >
    {children}
  </Formik>
);

describe('TokenSelectField', () => {
  const defaultProps = {
    name: 'tokenIndex',
    disabled: false,
    setIsNft: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTokensForRoute.mockReturnValue([mockTokens[0], mockTokens[1]]);
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('renders correctly in default state', () => {
      mockGetTokensForRoute.mockReturnValue([mockTokens[0], mockTokens[1]]);

      render(
        <FormWrapper>
          <TokenSelectField {...defaultProps} />
        </FormWrapper>,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Select Token');
      expect(screen.getByTestId('chevron-icon')).toBeInTheDocument();
    });

    it('renders selected token when value is provided', () => {
      mockGetTokensForRoute.mockReturnValue([mockTokens[0]]);

      render(
        <FormWrapper initialValues={{ tokenIndex: 0 }}>
          <TokenSelectField {...defaultProps} />
        </FormWrapper>,
      );

      expect(screen.getByTestId('token-icon')).toBeInTheDocument();
      expect(screen.getByTestId('token-icon')).toHaveTextContent('TEST');
    });

    it('renders as disabled when disabled prop is true', () => {
      render(
        <FormWrapper>
          <TokenSelectField {...defaultProps} disabled={true} />
        </FormWrapper>,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gray-100', 'cursor-default');
    });

    it('shows "No routes available" when no tokens are available', async () => {
      mockGetTokensForRoute.mockReturnValue([]);

      render(
        <FormWrapper>
          <TokenSelectField {...defaultProps} />
        </FormWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveTextContent('No routes available');
      });
    });
  });

  describe('Interactions', () => {
    it('opens modal on click when not disabled', async () => {
      render(
        <FormWrapper>
          <TokenSelectField {...defaultProps} />
        </FormWrapper>,
      );

      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByTestId('token-modal')).toBeInTheDocument();
    });

    it('does not open modal when disabled', async () => {
      render(
        <FormWrapper>
          <TokenSelectField {...defaultProps} disabled={true} />
        </FormWrapper>,
      );

      await userEvent.click(screen.getByRole('button'));
      expect(screen.queryByTestId('token-modal')).not.toBeInTheDocument();
    });

    it('handles token selection correctly', async () => {
      const { updateQueryParam } = await import('../../../utils/queryParams');
      render(
        <FormWrapper>
          <TokenSelectField {...defaultProps} />
        </FormWrapper>,
      );

      // Open modal
      await userEvent.click(screen.getByRole('button'));

      // Select token
      await userEvent.click(screen.getByTestId('select-token'));

      // Check if setIsNft was called
      expect(defaultProps.setIsNft).toHaveBeenCalledWith(false);

      // Check if updateQueryParam was called
      expect(updateQueryParam).toHaveBeenCalled();
    });

    it('handles unsupported route selection correctly', async () => {
      const { updateQueryParams } = await import('../../../utils/queryParams');

      render(
        <FormWrapper>
          <TokenSelectField {...defaultProps} />
        </FormWrapper>,
      );

      // Open modal
      await userEvent.click(screen.getByRole('button'));

      // Select unsupported token
      await userEvent.click(screen.getByTestId('select-unsupported'));

      // Check if updateQueryParams was called
      expect(updateQueryParams).toHaveBeenCalled();
    });
  });

  describe('Form Integration', () => {
    it('updates form values when token is selected', async () => {
      const onSubmit = vi.fn();
      render(
        <Formik
          initialValues={{
            origin: 'origin-chain',
            destination: 'destination-chain',
            tokenIndex: undefined,
          }}
          onSubmit={onSubmit}
        >
          {({ values }) => (
            <>
              <TokenSelectField {...defaultProps} />
              <div data-testid="form-value">{values.tokenIndex}</div>
            </>
          )}
        </Formik>,
      );

      // Open modal
      await userEvent.click(screen.getByRole('button'));

      // Select token
      await userEvent.click(screen.getByTestId('select-token'));

      // Check if form value was updated
      expect(screen.getByTestId('form-value')).toHaveTextContent('0');
    });
  });

  describe('Effects', () => {
    it('updates automatic selection state when tokens change', async () => {
      mockGetTokensForRoute.mockReturnValue([]);

      const { rerender } = render(
        <FormWrapper>
          <TokenSelectField {...defaultProps} data-testid="token-select" />
        </FormWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveTextContent('No routes available');
      });

      // Update available tokens
      mockGetTokensForRoute.mockReturnValue([mockTokens[0], mockTokens[1]]);

      // Re-render with new chains to trigger effect
      rerender(
        <FormWrapper initialValues={{ origin: 'new-origin', destination: 'new-destination' }}>
          <TokenSelectField {...defaultProps} data-testid="token-select" />
        </FormWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveTextContent('Select Token');
      });
    });
  });
});
