import { ChainName } from '@hyperlane-xyz/sdk';
import { ChainSearchMenuProps } from '@hyperlane-xyz/widgets';
import { fireEvent, render, screen } from '@testing-library/react';
import { Formik, type FormikProps } from 'formik';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransferFormValues } from '../../transfer/types';
import { ChainSelectField } from '../ChainSelectField';
import { useChainDisplayName } from '../hooks';

// Mock the useChainDisplayName hook
vi.mock('../hooks', () => ({
  useChainDisplayName: vi.fn(),
  useChainSelect: vi.fn(),
  useChainMetadata: vi.fn(),
}));

// Mock ChainSelectListModal
vi.mock('../ChainSelectModal', () => ({
  ChainSelectListModal: vi.fn(({ isOpen, close, onSelect }) =>
    isOpen ? (
      <div data-testid="chain-select-modal">
        Select a chain
        <button
          onClick={() => {
            onSelect('arbitrumsepolia' as ChainName);
            close();
          }}
        >
          Select Arbitrum Sepolia
        </button>
        <button onClick={close}>Close</button>
      </div>
    ) : null,
  ),
}));

describe('ChainSelectField', () => {
  const mockOnChange = vi.fn();
  const initialValues: TransferFormValues = {
    origin: 'sepolia' as ChainName,
    recipient: '',
    amount: '',
    destination: 'arbitrumsepolia' as ChainName,
    tokenIndex: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useChainDisplayName as any).mockReturnValue('Sepolia');
  });

  const renderComponent = (props?: Partial<React.ComponentProps<typeof ChainSelectField>>) => {
    return render(
      <Formik initialValues={initialValues} onSubmit={vi.fn()}>
        {({ setFieldValue: _setFieldValue }) => (
          <ChainSelectField
            name="originChain"
            label="Origin Chain"
            customListItemField={
              'displayName' as unknown as ChainSearchMenuProps['customListItemField']
            } // Cast to correct type
            onChange={mockOnChange}
            {...props}
          />
        )}
      </Formik>,
    );
  };

  it('renders correctly with initial value', () => {
    renderComponent();
    expect(screen.getByLabelText('Origin Chain')).toBeInTheDocument();
    expect(screen.getByText('Sepolia')).toBeInTheDocument();
  });

  it('opens the modal when clicked', () => {
    renderComponent();
    const button = screen.getByRole('button', { name: /Origin Chain/i });
    fireEvent.click(button);
    expect(screen.getByText('Select a chain')).toBeInTheDocument();
  });

  it('does not open the modal when disabled', () => {
    renderComponent({ disabled: true });
    const button = screen.getByRole('button', { name: /Origin Chain/i });
    fireEvent.click(button);
    expect(screen.queryByText('Select a chain')).not.toBeInTheDocument();
  });

  it('calls onChange and resets form fields when a new chain is selected', async () => {
    const formikRef = createRef<FormikProps<TransferFormValues>>();
    render(
      <Formik initialValues={initialValues} onSubmit={vi.fn()} innerRef={formikRef}>
        {() => {
          return (
            <ChainSelectField
              name="originChain"
              label="Origin Chain"
              customListItemField={
                'displayName' as unknown as ChainSearchMenuProps['customListItemField']
              } // Cast to correct type
              onChange={mockOnChange}
            />
          );
        }}
      </Formik>,
    );

    const button = screen.getByRole('button', { name: /Origin Chain/i });
    fireEvent.click(button);

    const selectArbitrumButton = screen.getByRole('button', { name: /Select Arbitrum Sepolia/i });
    fireEvent.click(selectArbitrumButton);

    expect(mockOnChange).toHaveBeenCalledWith('arbitrumsepolia', 'originChain');
    expect(formikRef.current?.values.recipient).toBe('');
    expect(formikRef.current?.values.amount).toBe('');
    expect(screen.queryByText('Select a chain')).not.toBeInTheDocument(); // Modal should be closed
  });
});
