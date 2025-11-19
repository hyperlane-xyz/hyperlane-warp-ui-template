import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';
import type { PropsWithChildren, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipientConfirmationModal } from '../RecipientConfirmationModal';
import { TransferFormValues } from '../types';

// Mock the Modal component from @hyperlane-xyz/widgets
vi.mock('@hyperlane-xyz/widgets', () => ({
  Modal: ({
    isOpen,
    close,
    title,
    panelClassname,
    children,
  }: {
    isOpen: boolean;
    close: () => void;
    title: string;
    panelClassname: string;
    children: ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="modal" data-title={title} className={panelClassname}>
        <button data-testid="modal-close" onClick={close}>
          Close Modal
        </button>
        {children}
      </div>
    ) : null,
}));

// Mock the SolidButton component
vi.mock('../../../components/buttons/SolidButton', () => ({
  SolidButton: ({
    children,
    onClick,
    color,
    className,
  }: PropsWithChildren<{
    onClick?: () => void;
    color?: string;
    className?: string;
  }>) => (
    <button
      onClick={onClick}
      data-color={color}
      className={className}
      data-testid={`button-${children?.toString().toLowerCase().replace(/\s+/g, '-')}`}
    >
      {children}
    </button>
  ),
}));

// Helper component to wrap the modal with Formik context
const TestWrapper = ({
  children,
  initialValues,
}: PropsWithChildren<{
  initialValues: TransferFormValues;
}>) => (
  <Formik initialValues={initialValues} onSubmit={() => {}}>
    {children}
  </Formik>
);

describe('RecipientConfirmationModal', () => {
  const mockClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const defaultProps = {
    isOpen: true,
    close: mockClose,
    onConfirm: mockOnConfirm,
  };

  const mockFormValues: TransferFormValues = {
    origin: 'ethereum' as any,
    destination: 'polygon' as any,
    tokenIndex: 0,
    amount: '100',
    recipient: '0x1234567890123456789012345678901234567890',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    it('renders the modal when isOpen is true', () => {
      render(
        <TestWrapper initialValues={mockFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal')).toHaveAttribute(
        'data-title',
        'Confirm Recipient Address',
      );
    });

    it('does not render the modal when isOpen is false', () => {
      render(
        <TestWrapper initialValues={mockFormValues}>
          <RecipientConfirmationModal {...defaultProps} isOpen={false} />
        </TestWrapper>,
      );

      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('renders with correct title and panel classname', () => {
      render(
        <TestWrapper initialValues={mockFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      const modal = screen.getByTestId('modal');
      expect(modal).toHaveAttribute('data-title', 'Confirm Recipient Address');
      expect(modal).toHaveClass('flex', 'flex-col', 'items-center', 'p-4', 'gap-5');
    });
  });

  describe('Content Display', () => {
    it('displays the warning message about recipient address', () => {
      render(
        <TestWrapper initialValues={mockFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      expect(
        screen.getByText(
          'The recipient address has no funds on the destination chain. Is this address correct?',
        ),
      ).toBeInTheDocument();
    });

    it('displays the recipient address from form values', () => {
      render(
        <TestWrapper initialValues={mockFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText(mockFormValues.recipient)).toBeInTheDocument();
    });

    it('displays recipient address with correct styling', () => {
      render(
        <TestWrapper initialValues={mockFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      const recipientElement = screen.getByText(mockFormValues.recipient);
      expect(recipientElement).toHaveClass(
        'rounded-lg',
        'bg-primary-500/5',
        'p-2',
        'text-center',
        'text-sm',
      );
    });
  });

  describe('Button Interactions', () => {
    it('renders Cancel and Continue buttons', () => {
      render(
        <TestWrapper initialValues={mockFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('button-cancel')).toBeInTheDocument();
      expect(screen.getByTestId('button-continue')).toBeInTheDocument();
    });

    it('calls close function when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper initialValues={mockFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      await user.click(screen.getByTestId('button-cancel'));
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('calls close and onConfirm functions when Continue button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper initialValues={mockFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      await user.click(screen.getByTestId('button-continue'));
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('applies correct styling to Cancel button', () => {
      render(
        <TestWrapper initialValues={mockFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      const cancelButton = screen.getByTestId('button-cancel');
      expect(cancelButton).toHaveAttribute('data-color', 'gray');
      expect(cancelButton).toHaveClass('min-w-24', 'px-4', 'py-1');
    });

    it('applies correct styling to Continue button', () => {
      render(
        <TestWrapper initialValues={mockFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      const continueButton = screen.getByTestId('button-continue');
      expect(continueButton).toHaveAttribute('data-color', 'primary');
      expect(continueButton).toHaveClass('min-w-24', 'px-4', 'py-1');
    });
  });

  describe('Formik Integration', () => {
    it('uses Formik context to get recipient value', () => {
      const customRecipient = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const customFormValues = {
        ...mockFormValues,
        recipient: customRecipient,
      };

      render(
        <TestWrapper initialValues={customFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText(customRecipient)).toBeInTheDocument();
    });

    it('handles empty recipient address', () => {
      const emptyFormValues = {
        ...mockFormValues,
        recipient: '',
      };

      render(
        <TestWrapper initialValues={emptyFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      // Should still render the modal and buttons even with empty recipient
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('button-cancel')).toBeInTheDocument();
      expect(screen.getByTestId('button-continue')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides accessible button labels', () => {
      render(
        <TestWrapper initialValues={mockFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    });

    it('has proper semantic structure', () => {
      render(
        <TestWrapper initialValues={mockFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      // Check that the modal has proper structure
      const modal = screen.getByTestId('modal');
      expect(modal).toBeInTheDocument();

      // Check that buttons are properly grouped
      const buttonContainer = modal.querySelector('.flex.items-center.justify-center.gap-12');
      expect(buttonContainer).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles very long recipient addresses', () => {
      const longRecipient = '0x' + 'a'.repeat(60); // 62 character address
      const longFormValues = {
        ...mockFormValues,
        recipient: longRecipient,
      };

      render(
        <TestWrapper initialValues={longFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByText(longRecipient)).toBeInTheDocument();
    });

    it('handles undefined form values gracefully', () => {
      // Test with minimal form values
      const minimalFormValues = {
        origin: 'ethereum' as any,
        destination: 'polygon' as any,
        tokenIndex: undefined,
        amount: '',
        recipient: '0x1234567890123456789012345678901234567890',
      };

      render(
        <TestWrapper initialValues={minimalFormValues}>
          <RecipientConfirmationModal {...defaultProps} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText(minimalFormValues.recipient)).toBeInTheDocument();
    });
  });
});
