import { render, screen } from '@testing-library/react';
import { toast } from 'react-toastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IgpDetailsToast, toastIgpDetails } from '../IgpDetailsToast';

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('../../consts/links', () => ({
  links: {
    gasDocs: 'https://docs.hyperlane.xyz/docs/reference/hooks/interchain-gas',
  },
}));

describe('IgpDetailsToast', () => {
  it('should render with default token name', () => {
    render(<IgpDetailsToast igpFee="0.01" tokenName="native token" />);
    expect(screen.getByText(/Cross-chain transfers require a fee of/)).toBeInTheDocument();
    expect(screen.getByText(/0.01/)).toBeInTheDocument();
    expect(screen.getByText(/native token/)).toBeInTheDocument();
  });

  it('should render with custom token name', () => {
    render(<IgpDetailsToast igpFee="0.5" tokenName="ETH" />);
    expect(screen.getByText(/0.5/)).toBeInTheDocument();
    expect(screen.getByText(/ETH/)).toBeInTheDocument();
  });

  it('should render Learn More link', () => {
    render(<IgpDetailsToast igpFee="0.01" tokenName="ETH" />);
    const link = screen.getByText('Learn More');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      'https://docs.hyperlane.xyz/docs/reference/hooks/interchain-gas',
    );
  });

  it('should open link in new tab', () => {
    render(<IgpDetailsToast igpFee="0.01" tokenName="ETH" />);
    const link = screen.getByText('Learn More');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should have underlined link', () => {
    render(<IgpDetailsToast igpFee="0.01" tokenName="ETH" />);
    const link = screen.getByText('Learn More');
    expect(link).toHaveClass('underline');
  });

  it('should mention insufficient balance', () => {
    render(<IgpDetailsToast igpFee="0.01" tokenName="ETH" />);
    expect(screen.getByText(/Your ETH balance is insufficient/)).toBeInTheDocument();
  });
});

describe('toastIgpDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call toast.error', () => {
    toastIgpDetails('0.01', 'ETH');
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('should call toast with correct autoClose time', () => {
    toastIgpDetails('0.01', 'ETH');
    expect(toast.error).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ autoClose: 5000 }),
    );
  });

  it('should use default token name when not provided', () => {
    toastIgpDetails('0.01');
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('should pass igpFee to toast component', () => {
    toastIgpDetails('0.5', 'BNB');
    expect(toast.error).toHaveBeenCalledWith(expect.anything(), expect.any(Object));
  });
});
