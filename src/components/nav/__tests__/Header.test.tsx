import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from '../Header';

// Mock dependencies
vi.mock('next/image', () => ({
  default: ({ src, alt, width }: any) => (
    <img src={src} alt={alt} width={width} data-testid="logo-image" />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('../../features/wallet/ConnectWalletButton', () => ({
  ConnectWalletButton: () => <button data-testid="connect-wallet">Connect Wallet</button>,
}));

vi.mock('@hyperlane-xyz/widgets', () => ({
  useAccounts: vi.fn(() => ({})),
  useConnectFns: vi.fn(() => ({})),
  WidgetsProvider: ({ children }: any) => children,
  ConnectWalletButton: () => <button data-testid="connect-wallet">Connect Wallet</button>,
}));

vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({ address: undefined })),
  useConfig: vi.fn(() => ({})),
  WagmiProvider: ({ children }: any) => children,
}));

vi.mock('../../images/logos/app-logo.svg', () => ({
  default: '/logo.svg',
}));

describe('Header', () => {
  it('should render header element', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();
  });

  it('should render logo image', () => {
    render(<Header />);
    const logo = screen.getByTestId('logo-image');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('width', '128');
  });

  it('should render logo link to homepage', () => {
    render(<Header />);
    const logoLink = screen.getByRole('link');
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('should render connect wallet button', () => {
    render(<Header />);
    const connectButton = screen.getByTestId('connect-wallet');
    expect(connectButton).toBeInTheDocument();
  });

  it('should have correct logo alt text', () => {
    render(<Header />);
    const logo = screen.getByTestId('logo-image');
    expect(logo).toHaveAttribute('alt', '');
  });

  it('should have responsive padding classes', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');
    expect(header).toHaveClass('px-2', 'sm:px-6', 'lg:px-12');
  });

  it('should have flex layout for logo and button', () => {
    const { container } = render(<Header />);
    const flexContainer = container.querySelector('.flex.items-start.justify-between');
    expect(flexContainer).toBeInTheDocument();
  });
});
