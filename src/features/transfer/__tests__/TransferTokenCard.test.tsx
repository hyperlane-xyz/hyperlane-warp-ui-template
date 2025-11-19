import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransferTokenCard } from '../TransferTokenCard';

// Mock the Card component
vi.mock('../../../components/layout/Card', () => ({
  Card: ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}));

// Mock the TransferTokenForm component
vi.mock('../TransferTokenForm', () => ({
  TransferTokenForm: () => <div data-testid="transfer-token-form">Transfer Token Form</div>,
}));

describe('TransferTokenCard', () => {
  it('renders the component successfully', () => {
    render(<TransferTokenCard />);

    // Check that the Card wrapper is rendered
    expect(screen.getByTestId('card')).toBeInTheDocument();

    // Check that the TransferTokenForm is rendered inside the Card
    expect(screen.getByTestId('transfer-token-form')).toBeInTheDocument();
  });

  it('applies correct CSS classes to the Card', () => {
    render(<TransferTokenCard />);

    const card = screen.getByTestId('card');
    expect(card).toHaveClass('w-100', 'sm:w-[31rem]');
  });

  it('renders TransferTokenForm as a child of Card', () => {
    render(<TransferTokenCard />);

    const card = screen.getByTestId('card');
    const form = screen.getByTestId('transfer-token-form');

    // Check that the form is inside the card
    expect(card).toContainElement(form);
  });

  it('has the correct component structure', () => {
    render(<TransferTokenCard />);

    // Verify the component structure: Card > TransferTokenForm
    const card = screen.getByTestId('card');
    const form = screen.getByTestId('transfer-token-form');

    expect(card).toBeInTheDocument();
    expect(form).toBeInTheDocument();
    expect(card).toContainElement(form);
  });
});
