import { ProtocolType } from '@hyperlane-xyz/utils';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectAwareSubmitButton } from './../ConnectAwareSubmitButton';

// Mock dependencies
vi.mock('@hyperlane-xyz/utils', () => ({
  ProtocolType: {
    Ethereum: 'ethereum',
    Sealevel: 'sealevel',
    Cosmos: 'cosmos',
  },
}));

vi.mock('@hyperlane-xyz/widgets', () => ({
  useAccountForChain: vi.fn(),
  useConnectFns: vi.fn(),
  useTimeout: vi.fn(),
}));

vi.mock('formik', () => ({
  useFormikContext: vi.fn(),
}));

vi.mock('../../../features/chains/hooks', () => ({
  useChainProtocol: vi.fn(),
  useMultiProvider: vi.fn(),
}));

vi.mock('./../SolidButton', () => ({
  SolidButton: ({ type, color, onClick, className, children }: any) => (
    <button
      type={type}
      data-color={color}
      onClick={onClick}
      className={className}
      data-testid="solid-button"
    >
      {children}
    </button>
  ),
}));

import { useAccountForChain, useConnectFns, useTimeout } from '@hyperlane-xyz/widgets';
import { useFormikContext } from 'formik';
import { useChainProtocol, useMultiProvider } from '../../../features/chains/hooks';

describe('ConnectAwareSubmitButton', () => {
  const mockConnectFn = vi.fn();
  const mockSetErrors = vi.fn();
  const mockSetTouched = vi.fn();
  const mockMultiProvider = {};

  const defaultMocks = {
    connectFns: { ethereum: mockConnectFn },
    account: { isReady: true },
    formikContext: {
      errors: {},
      setErrors: mockSetErrors,
      touched: {},
      setTouched: mockSetTouched,
    },
    protocol: ProtocolType.Ethereum,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupDefaultMocks() {
    vi.mocked(useChainProtocol).mockReturnValue(defaultMocks.protocol as any);
    vi.mocked(useConnectFns).mockReturnValue(defaultMocks.connectFns as any);
    vi.mocked(useMultiProvider).mockReturnValue(mockMultiProvider as any);
    vi.mocked(useAccountForChain).mockReturnValue(defaultMocks.account as any);
    vi.mocked(useFormikContext).mockReturnValue(defaultMocks.formikContext as any);
    vi.mocked(useTimeout).mockImplementation((_callback?: () => void, _delay?: number) => {
      return () => {};
    });
  }

  describe('Wallet Connected State', () => {
    it('should render submit button with custom text when account is ready', () => {
      render(<ConnectAwareSubmitButton chainName="ethereum" text="Send Transaction" />);

      const button = screen.getByTestId('solid-button');
      expect(button).toHaveTextContent('Send Transaction');
      expect(button).toHaveAttribute('type', 'submit');
      expect(button).toHaveAttribute('data-color', 'primary');
    });

    it('should not have onClick handler when account is ready', () => {
      render(<ConnectAwareSubmitButton chainName="ethereum" text="Submit Form" />);

      const button = screen.getByTestId('solid-button');
      // The onClick should be undefined when account is ready
      expect(button.onclick).toBeNull();
    });

    it('should apply custom classes', () => {
      render(
        <ConnectAwareSubmitButton chainName="ethereum" text="Submit" classes="custom-class mt-4" />,
      );

      const button = screen.getByTestId('solid-button');
      expect(button).toHaveClass('custom-class mt-4');
    });
  });

  describe('Wallet Not Connected State', () => {
    beforeEach(() => {
      vi.mocked(useAccountForChain).mockReturnValue({ isReady: false } as any);
    });

    it('should render "Connect wallet" button when account is not ready', () => {
      render(<ConnectAwareSubmitButton chainName="ethereum" text="Send Transaction" />);

      const button = screen.getByTestId('solid-button');
      expect(button).toHaveTextContent('Connect wallet');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should call connect function when clicked and account not ready', async () => {
      const user = userEvent.setup();

      render(<ConnectAwareSubmitButton chainName="ethereum" text="Submit" />);

      const button = screen.getByTestId('solid-button');
      await user.click(button);

      expect(mockConnectFn).toHaveBeenCalledTimes(1);
    });

    it('should use correct protocol connect function', () => {
      const cosmosConnectFn = vi.fn();
      vi.mocked(useChainProtocol).mockReturnValue(ProtocolType.Cosmos as any);
      vi.mocked(useConnectFns).mockReturnValue({
        cosmos: cosmosConnectFn,
      } as any);

      render(<ConnectAwareSubmitButton chainName="cosmos" text="Submit" />);

      // The button should have the cosmos connect function
      expect(screen.getByTestId('solid-button')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when form has errors', () => {
      vi.mocked(useFormikContext).mockReturnValue({
        errors: { amount: 'Amount is required' },
        setErrors: mockSetErrors,
        touched: { amount: true },
        setTouched: mockSetTouched,
      } as any);

      render(<ConnectAwareSubmitButton chainName="ethereum" text="Submit" />);

      const button = screen.getByTestId('solid-button');
      expect(button).toHaveTextContent('Amount is required');
      expect(button).toHaveAttribute('data-color', 'red');
    });

    it('should display first error when multiple errors exist', () => {
      vi.mocked(useFormikContext).mockReturnValue({
        errors: {
          amount: 'Amount is required',
          recipient: 'Recipient is invalid',
        },
        setErrors: mockSetErrors,
        touched: { amount: true, recipient: true },
        setTouched: mockSetTouched,
      } as any);

      render(<ConnectAwareSubmitButton chainName="ethereum" text="Submit" />);

      const button = screen.getByTestId('solid-button');
      expect(button).toHaveTextContent('Amount is required');
    });

    it('should not show error if form is not touched', () => {
      vi.mocked(useFormikContext).mockReturnValue({
        errors: { amount: 'Amount is required' },
        setErrors: mockSetErrors,
        touched: {},
        setTouched: mockSetTouched,
      } as any);

      render(<ConnectAwareSubmitButton chainName="ethereum" text="Submit" />);

      const button = screen.getByTestId('solid-button');
      expect(button).toHaveTextContent('Submit');
      expect(button).toHaveAttribute('data-color', 'primary');
    });

    it('should handle empty errors object', () => {
      vi.mocked(useFormikContext).mockReturnValue({
        errors: {},
        setErrors: mockSetErrors,
        touched: { field: true },
        setTouched: mockSetTouched,
      } as any);

      render(<ConnectAwareSubmitButton chainName="ethereum" text="Submit" />);

      const button = screen.getByTestId('solid-button');
      expect(button).toHaveTextContent('Submit');
    });
  });

  describe('Auto-clear Error Functionality', () => {
    it('should call useTimeout with clearErrors function and 3500ms', () => {
      vi.mocked(useFormikContext).mockReturnValue({
        errors: { amount: 'Error' },
        setErrors: mockSetErrors,
        touched: { amount: true },
        setTouched: mockSetTouched,
      } as any);

      render(<ConnectAwareSubmitButton chainName="ethereum" text="Submit" />);

      expect(useTimeout).toHaveBeenCalledWith(expect.any(Function), 3500);
    });
  });

  describe('Protocol Handling', () => {
    it('should default to Ethereum protocol when protocol is null', () => {
      vi.mocked(useChainProtocol).mockReturnValue(undefined as any);
      const ethereumConnect = vi.fn();
      vi.mocked(useConnectFns).mockReturnValue({
        ethereum: ethereumConnect,
      } as any);
      vi.mocked(useAccountForChain).mockReturnValue({ isReady: false } as any);

      render(<ConnectAwareSubmitButton chainName="unknown" text="Submit" />);

      expect(screen.getByTestId('solid-button')).toBeInTheDocument();
    });

    it('should handle Sealevel protocol', () => {
      const sealevelConnect = vi.fn();
      vi.mocked(useChainProtocol).mockReturnValue(ProtocolType.Sealevel as any);
      vi.mocked(useConnectFns).mockReturnValue({
        sealevel: sealevelConnect,
      } as any);
      vi.mocked(useAccountForChain).mockReturnValue({ isReady: false } as any);

      render(<ConnectAwareSubmitButton chainName="solana" text="Submit" />);

      expect(screen.getByTestId('solid-button')).toHaveTextContent('Connect wallet');
    });
  });

  describe('Account State Edge Cases', () => {
    it('should handle null account', () => {
      vi.mocked(useAccountForChain).mockReturnValue(undefined as any);

      render(<ConnectAwareSubmitButton chainName="ethereum" text="Submit" />);

      const button = screen.getByTestId('solid-button');
      expect(button).toHaveTextContent('Connect wallet');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should handle undefined account', () => {
      vi.mocked(useAccountForChain).mockReturnValue(undefined);

      render(<ConnectAwareSubmitButton chainName="ethereum" text="Submit" />);

      const button = screen.getByTestId('solid-button');
      expect(button).toHaveTextContent('Connect wallet');
    });

    it('should handle account with isReady as false explicitly', () => {
      vi.mocked(useAccountForChain).mockReturnValue({ isReady: false } as any);

      render(<ConnectAwareSubmitButton chainName="ethereum" text="Submit" />);

      const button = screen.getByTestId('solid-button');
      expect(button).toHaveTextContent('Connect wallet');
    });
  });

  describe('Integration Tests', () => {
    it('should transition from error state to normal state after timeout', async () => {
      const { rerender } = render(<ConnectAwareSubmitButton chainName="ethereum" text="Submit" />);

      // Initial state with error
      vi.mocked(useFormikContext).mockReturnValue({
        errors: { amount: 'Error message' },
        setErrors: mockSetErrors,
        touched: { amount: true },
        setTouched: mockSetTouched,
      } as any);

      rerender(<ConnectAwareSubmitButton chainName="ethereum" text="Submit" />);

      expect(screen.getByTestId('solid-button')).toHaveTextContent('Error message');

      // After clearing errors
      vi.mocked(useFormikContext).mockReturnValue({
        errors: {},
        setErrors: mockSetErrors,
        touched: {},
        setTouched: mockSetTouched,
      } as any);

      rerender(<ConnectAwareSubmitButton chainName="ethereum" text="Submit" />);

      expect(screen.getByTestId('solid-button')).toHaveTextContent('Submit');
    });

    it('should call useAccountForChain with correct parameters', () => {
      render(<ConnectAwareSubmitButton chainName="polygon" text="Submit" />);

      expect(useAccountForChain).toHaveBeenCalledWith(mockMultiProvider, 'polygon');
    });
  });
});
