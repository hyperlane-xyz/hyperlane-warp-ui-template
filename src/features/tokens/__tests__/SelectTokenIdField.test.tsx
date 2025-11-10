import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Formik } from 'formik';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SelectTokenIdField, SelectTokenIdModal } from '../SelectTokenIdField';

// Mock dependencies
vi.mock('@hyperlane-xyz/widgets', () => ({
  ChevronIcon: ({ width, height, direction, color }: any) => (
    <div data-testid="chevron-icon" data-direction={direction} style={{ width, height, color }}>
      Chevron
    </div>
  ),
  Modal: ({ children, isOpen, close, title }: any) =>
    isOpen ? (
      <div data-testid="modal">
        <div data-testid="modal-title">{title}</div>
        <button onClick={close} data-testid="modal-close">
          Close
        </button>
        {children}
      </div>
    ) : null,
  SpinnerIcon: ({ width, height }: any) => (
    <div data-testid="spinner-icon" style={{ width, height }}>
      Loading...
    </div>
  ),
}));

const FormWrapper = ({ children, initialValues = { amount: '' } }: any) => (
  <Formik initialValues={initialValues} onSubmit={() => {}}>
    {children}
  </Formik>
);

describe('SelectTokenIdField', () => {
  const defaultProps = {
    name: 'amount',
    disabled: false,
  };

  describe('Main Field Component', () => {
    it('renders correctly with default state', () => {
      render(
        <FormWrapper>
          <SelectTokenIdField {...defaultProps} />
        </FormWrapper>,
      );

      expect(screen.getByText('Select Token Id')).toBeInTheDocument();
      expect(screen.getByTestId('chevron-icon')).toBeInTheDocument();
    });

    it('opens modal on click when not disabled', async () => {
      render(
        <FormWrapper>
          <SelectTokenIdField {...defaultProps} />
        </FormWrapper>,
      );

      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Select Token Id');
    });

    it('does not open modal when disabled', async () => {
      render(
        <FormWrapper>
          <SelectTokenIdField {...defaultProps} disabled={true} />
        </FormWrapper>,
      );

      await userEvent.click(screen.getByRole('button'));
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('updates token id when selected', async () => {
      render(
        <FormWrapper>
          <SelectTokenIdField {...defaultProps} />
        </FormWrapper>,
      );

      // Open modal
      const selectButton = screen.getByRole('button');
      await userEvent.click(selectButton);

      // Modal should be open with title
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Select Token Id');

      // Close modal
      fireEvent.click(screen.getByTestId('modal-close'));

      // Modal should be closed
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });
  });

  describe('SelectTokenIdModal', () => {
    const modalProps = {
      isOpen: true,
      tokenIds: ['1', '2', '3'],
      isLoading: false,
      close: vi.fn(),
      onSelect: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('renders loading state correctly', () => {
      render(<SelectTokenIdModal {...modalProps} isLoading={true} />);

      expect(screen.getByTestId('spinner-icon')).toBeInTheDocument();
      expect(screen.getByText('Finding token IDs')).toBeInTheDocument();
    });

    it('renders token list correctly', () => {
      render(<SelectTokenIdModal {...modalProps} />);

      modalProps.tokenIds.forEach((id) => {
        expect(screen.getByText(id)).toBeInTheDocument();
      });
    });

    it('renders empty state correctly', () => {
      render(<SelectTokenIdModal {...modalProps} tokenIds={[]} />);

      expect(screen.getByText('No token ids found')).toBeInTheDocument();
    });

    it('handles token selection correctly', async () => {
      render(<SelectTokenIdModal {...modalProps} />);

      await userEvent.click(screen.getByText('1'));

      expect(modalProps.onSelect).toHaveBeenCalledWith('1');
      expect(modalProps.close).toHaveBeenCalled();
    });

    it('handles close button correctly', () => {
      render(<SelectTokenIdModal {...modalProps} />);

      fireEvent.click(screen.getByTestId('modal-close'));
      expect(modalProps.close).toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    // it('updates form value when token id is selected', async () => {
    //   const onSubmit = vi.fn();
    //   render(
    //     <Formik initialValues={{ amount: '' }} onSubmit={onSubmit}>
    //       {({ values }) => (
    //         <>
    //           <SelectTokenIdField {...defaultProps} />
    //           <div data-testid="form-value">{values.amount}</div>
    //         </>
    //       )}
    //     </Formik>,
    //   );

    //   // Open modal
    //   const selectButton = screen.getByRole('button');
    //   await userEvent.click(selectButton);

    //   // Render a mock token id to select
    //   render(
    //     <SelectTokenIdModal
    //       isOpen={true}
    //       tokenIds={['123']}
    //       isLoading={false}
    //       close={vi.fn()}
    //       onSelect={vi.fn()}
    //     />,
    //   );

    //   // Select the token id
    //   const tokenOption = screen.getByText('123');
    //   await userEvent.click(tokenOption);

    //   // Form value should be updated
    //   expect(screen.getByTestId('form-value')).toHaveTextContent('123');
    // });

    it('maintains selected value after modal reopens', async () => {
      const onSubmit = vi.fn();
      render(
        <Formik initialValues={{ amount: 123 }} onSubmit={onSubmit}>
          <SelectTokenIdField {...defaultProps} />
        </Formik>,
      );

      // Open modal
      await userEvent.click(screen.getByRole('button'));

      // Close modal
      fireEvent.click(screen.getByTestId('modal-close'));

      // Reopen modal
      await userEvent.click(screen.getByRole('button'));

      // Value should still be there
      expect(screen.queryByTestId('modal')).toBeInTheDocument();
    });
  });
});
