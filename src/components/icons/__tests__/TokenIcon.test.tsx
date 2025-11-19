import { IToken } from '@hyperlane-xyz/sdk';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TokenIcon } from '../TokenIcon';

// Mock dependencies
vi.mock('@hyperlane-xyz/widgets', () => ({
  Circle: ({ children, size, bgColorSeed, title }: any) => (
    <div data-testid="circle" data-size={size} data-bg-color-seed={bgColorSeed} title={title}>
      {children}
    </div>
  ),
}));

vi.mock('@hyperlane-xyz/utils', () => ({
  isHttpsUrl: (url: string) => url.startsWith('https://'),
  isRelativeUrl: (url: string) => !url.startsWith('/') && !url.startsWith('https://'),
}));

vi.mock('../../consts/links', () => ({
  links: {
    imgPath: 'https://cdn.jsdelivr.net/gh/hyperlane-xyz/hyperlane-registry@main',
  },
}));

describe('TokenIcon', () => {
  const mockToken = {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    addressOrDenom: '0x1234567890',
    chainName: 'ethereum',
    logoURI: 'https://example.com/eth.png',
  } as unknown as IToken;

  it('should render with token image', () => {
    render(<TokenIcon token={mockToken} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/eth.png');
    expect(img).toHaveAttribute('alt', 'ETH');
  });

  it('should render with custom size', () => {
    render(<TokenIcon token={mockToken} size={48} />);
    const circle = screen.getByTestId('circle');
    expect(circle).toHaveAttribute('data-size', '48');
  });

  it('should render with default size', () => {
    render(<TokenIcon token={mockToken} />);
    const circle = screen.getByTestId('circle');
    expect(circle).toHaveAttribute('data-size', '32');
  });

  it('should render first character when no logo is provided', () => {
    const tokenWithoutLogo = { ...mockToken, logoURI: undefined };
    render(<TokenIcon token={tokenWithoutLogo} />);
    expect(screen.getByText('E')).toBeInTheDocument();
  });

  it('should handle token without symbol', () => {
    const tokenWithoutSymbol = { ...mockToken, symbol: '' };
    render(<TokenIcon token={tokenWithoutSymbol} />);
    const circle = screen.getByTestId('circle');
    expect(circle).toHaveAttribute('title', '');
  });

  it('should fallback to text on image error', async () => {
    render(<TokenIcon token={mockToken} />);
    const img = screen.getByRole('img');

    // Simulate image error
    img.dispatchEvent(new Event('error'));

    await waitFor(() => {
      expect(screen.getByText('E')).toBeInTheDocument();
    });
  });

  it('should handle null token', () => {
    render(<TokenIcon token={null} />);
    const circle = screen.getByTestId('circle');
    expect(circle).toBeInTheDocument();
  });

  it('should handle undefined token', () => {
    render(<TokenIcon token={undefined} />);
    const circle = screen.getByTestId('circle');
    expect(circle).toBeInTheDocument();
  });

  it('should handle local path logoURI', () => {
    const tokenWithLocalPath = { ...mockToken, logoURI: '/images/token.png' };
    render(<TokenIcon token={tokenWithLocalPath} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/images/token.png');
  });

  it('should handle relative URL logoURI', () => {
    const tokenWithRelativePath = { ...mockToken, logoURI: 'tokens/eth.png' };
    render(<TokenIcon token={tokenWithRelativePath} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute(
      'src',
      'https://cdn.jsdelivr.net/gh/hyperlane-xyz/hyperlane-registry@maintokens/eth.png',
    );
  });

  it('should set bgColorSeed when no image available', () => {
    const tokenWithoutLogo = { ...mockToken, logoURI: undefined };
    render(<TokenIcon token={tokenWithoutLogo} />);
    const circle = screen.getByTestId('circle');
    expect(circle).toHaveAttribute('data-bg-color-seed');
  });
});
