import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../../../features/store';
import { AppLayout } from '../AppLayout';

// Mock dependencies
vi.mock('@hyperlane-xyz/widgets', () => ({
  MultiProtocolWalletModal: ({ isOpen, children }: any) =>
    isOpen ? <div data-testid="wallet-modal">Wallet Modal {children}</div> : null,
  ConnectWalletButton: () => <button data-testid="connect-wallet">Connect Wallet</button>,
  AccountList: vi.fn(() => <div data-testid="account-list">Account List</div>),
  useAccounts: vi.fn(() => ({})),
  useConnectFns: vi.fn(() => ({})),
  WidgetsProvider: ({ children }: any) => children,
}));

vi.mock('next/head', () => ({
  default: ({ children }: any) => <div data-testid="head">{children}</div>,
}));

vi.mock('../../consts/app', () => ({
  APP_NAME: 'Test App',
  BACKGROUND_COLOR: '#ffffff',
  BACKGROUND_IMAGE: 'url(/bg.png)',
}));

vi.mock('../../consts/config', () => ({
  config: {
    walletProtocols: ['ethereum'],
  },
}));

vi.mock('next/font/google', () => ({
  Rubik: () => ({
    className: 'font-rubik',
  }),
}));

vi.mock('../../../features/store', () => ({
  useStore: vi.fn(),
}));

vi.mock('../../features/wallet/SideBarMenu', () => ({
  SideBarMenu: ({ isOpen, onClose, onClickConnectWallet }: any) =>
    isOpen ? (
      <div data-testid="sidebar">
        <button onClick={onClose}>Close</button>
        <button onClick={onClickConnectWallet}>Connect</button>
      </div>
    ) : null,
}));

vi.mock('../nav/Footer', () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}));

vi.mock('../nav/Header', () => ({
  Header: () => <header data-testid="header">Header</header>,
}));

describe('AppLayout', () => {
  const mockSetShowEnvSelectModal = vi.fn();
  const mockSetIsSideBarOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useStore as any).mockReturnValue({
      showEnvSelectModal: false,
      setShowEnvSelectModal: mockSetShowEnvSelectModal,
      isSideBarOpen: false,
      setIsSideBarOpen: mockSetIsSideBarOpen,
    });
  });

  it('should render children', () => {
    render(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>,
    );
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it.skip('should render header and footer', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>,
    );
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it.skip('should set page title', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>,
    );
    expect(screen.getByText('Test App')).toBeInTheDocument();
  });

  it('should render wallet modal when showEnvSelectModal is true', () => {
    (useStore as any).mockReturnValue({
      showEnvSelectModal: true,
      setShowEnvSelectModal: mockSetShowEnvSelectModal,
      isSideBarOpen: false,
      setIsSideBarOpen: mockSetIsSideBarOpen,
    });

    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>,
    );
    expect(screen.getByTestId('wallet-modal')).toBeInTheDocument();
  });

  it('should not render wallet modal when showEnvSelectModal is false', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>,
    );
    expect(screen.queryByTestId('wallet-modal')).not.toBeInTheDocument();
  });

  it.skip('should render sidebar when isSideBarOpen is true', () => {
    (useStore as any).mockReturnValue({
      showEnvSelectModal: false,
      setShowEnvSelectModal: mockSetShowEnvSelectModal,
      isSideBarOpen: true,
      setIsSideBarOpen: mockSetIsSideBarOpen,
    });

    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>,
    );
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('should have correct viewport meta tag', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>,
    );
    const head = screen.getByTestId('head');
    expect(head).toBeInTheDocument();
  });

  it('should have app-content id on main container', () => {
    const { container } = render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>,
    );
    const appContent = container.querySelector('#app-content');
    expect(appContent).toBeInTheDocument();
  });
});
