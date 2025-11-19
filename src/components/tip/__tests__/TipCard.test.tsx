import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TipCard } from '../TipCard';

// Mock dependencies
vi.mock('@hyperlane-xyz/widgets', () => ({
  IconButton: ({ children, onClick, title, className }: any) => (
    <button onClick={onClick} title={title} className={className}>
      {children}
    </button>
  ),
  XCircleIcon: (props: any) => (
    <span data-testid="x-icon" {...props}>
      X
    </span>
  ),
}));

describe('TipCard', () => {
  it('should render when showTipBox is true', () => {
    vi.doMock('../../consts/config', () => ({
      config: {
        showTipBox: true,
      },
    }));

    const { container } = render(<TipCard />);
    expect(container.querySelector('.rounded-2xl')).toBeInTheDocument();
  });

  it('should render title text', () => {
    render(<TipCard />);
    expect(
      screen.getByText(
        'Pruv Bridge: A Secure Gateway for Moving Digital Assets Across the Pruv Ecosystem',
      ),
    ).toBeInTheDocument();
  });

  it('should render instructions text', () => {
    render(<TipCard />);
    expect(
      screen.getByText('To bridge your assets, follow these simple steps:'),
    ).toBeInTheDocument();
  });

  it('should render all instruction steps', () => {
    render(<TipCard />);
    expect(screen.getByText(/Select the origin and destination chain/)).toBeInTheDocument();
    expect(screen.getByText(/Pick the token you want to transfer/)).toBeInTheDocument();
    expect(screen.getByText(/Enter the amount/)).toBeInTheDocument();
    expect(screen.getByText(/Click/)).toBeInTheDocument();
  });

  it('should render close button', () => {
    render(<TipCard />);
    const closeButton = screen.getByTitle('Hide tip');
    expect(closeButton).toBeInTheDocument();
  });

  it('should hide tip card when close button is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<TipCard />);

    const closeButton = screen.getByTitle('Hide tip');
    await user.click(closeButton);

    expect(container.firstChild).toBeNull();
  });

  it('should render X icon in close button', () => {
    render(<TipCard />);
    expect(screen.getByTestId('x-icon')).toBeInTheDocument();
  });

  it('should have correct card width classes', () => {
    const { container } = render(<TipCard />);
    const card = container.querySelector('.rounded-2xl');
    expect(card).toHaveClass('w-100', 'sm:w-[31rem]');
  });

  it('should highlight Continue button text', () => {
    render(<TipCard />);
    const continueButton = screen.getByText('Continue');
    expect(continueButton.tagName).toBe('STRONG');
  });
});
