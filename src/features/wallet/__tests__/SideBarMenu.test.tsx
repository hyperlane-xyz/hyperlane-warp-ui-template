import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SideBarMenu } from '../SideBarMenu';

// Mocks and shared test state
let currentStore: any = {};
const resetFn = vi.fn();

vi.mock('next/image', () => {
  return {
    __esModule: true,
    default: (props: any) => {
      // Render an img so tests can query by src
      const { src, alt, ...rest } = props;
      return React.createElement('img', {
        src: typeof src === 'string' ? src : src?.default || src,
        alt: alt ?? '',
        ...rest,
      });
    },
  };
});

vi.mock('@hyperlane-xyz/widgets', () => ({
  __esModule: true,
  AccountList: (_props: any) => <div data-testid="account-list">AccountList</div>,
  SpinnerIcon: (props: any) => <span data-testid="spinner" {...props} />,
}));

vi.mock('../../../components/icons/ChainLogo', () => ({
  __esModule: true,
  ChainLogo: ({ chainName }: { chainName: string }) => (
    <span data-testid={`chain-${chainName}`}>{chainName}</span>
  ),
}));

// simple svg mocks used as src strings
vi.mock('../../../images/icons/arrow-right.svg', () => ({
  __esModule: true,
  default: 'arrow-right',
}));
vi.mock('../../../images/icons/collapse-icon.svg', () => ({
  __esModule: true,
  default: 'collapse-icon',
}));
vi.mock('../../../images/icons/reset-icon.svg', () => ({
  __esModule: true,
  default: 'reset-icon',
}));

vi.mock('../../chains/hooks', () => ({
  __esModule: true,
  useMultiProvider: () => ({
    /* provider stub */
  }),
}));

vi.mock('../../chains/utils', () => ({
  __esModule: true,
  getChainDisplayName: (_multiProvider: any, chainName: string) => `Display(${chainName})`,
}));

vi.mock('../../tokens/hooks', () => ({
  __esModule: true,
  useWarpCore: () => ({}),
  tryFindToken: (_warpCore: any, _chain: string, _addrOrDenom: string) => ({ symbol: 'TKN' }),
}));

vi.mock('../../store', () => ({
  __esModule: true,
  useStore: (selector: any) => selector(currentStore),
}));

vi.mock('../../transfer/TransfersDetailsModal', () => ({
  __esModule: true,
  TransfersDetailsModal: ({ isOpen, transfer }: any) =>
    isOpen ? <div data-testid="transfers-modal">Modal: {transfer?.amount ?? 'no'}</div> : null,
}));

vi.mock('../../transfer/utils', () => ({
  __esModule: true,
  getIconByTransferStatus: (_status: any) => 'status-icon',
  STATUSES_WITH_ICON: ['completed', 'failed'],
}));

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('SideBarMenu', () => {
  beforeEach(() => {
    resetFn.mockClear();
    currentStore = {
      transfers: [],
      resetTransfers: resetFn,
      transferLoading: false,
      originChainName: 'originChain',
    };
  });

  it('renders connected wallets and transfer history and AccountList', () => {
    const onClose = vi.fn();
    const onConnect = vi.fn();
    render(<SideBarMenu isOpen={true} onClose={onClose} onClickConnectWallet={onConnect} />);

    expect(screen.getByText('Connected Wallets')).toBeDefined();
    expect(screen.getByText('Transfer History')).toBeDefined();
    expect(screen.getByTestId('account-list')).toBeDefined();

    // collapse icon should be rendered as img with src equal to our mocked collapse-icon
    const collapseImg = document.querySelector(
      'img[src="collapse-icon"]',
    ) as HTMLImageElement | null;
    expect(collapseImg).not.toBeNull();
    // its parent is the button that triggers onClose
    const collapseButton = collapseImg?.closest('button') as HTMLButtonElement;
    expect(collapseButton).not.toBeNull();
    fireEvent.click(collapseButton!);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders transfers sorted by timestamp (descending) and shows reset button', () => {
    const onClose = vi.fn();
    const onConnect = vi.fn();

    currentStore.transfers = [
      {
        amount: '1',
        origin: 'A',
        destination: 'B',
        status: 'completed',
        timestamp: 100,
        originTokenAddressOrDenom: 'denom1',
      },
      {
        amount: '2',
        origin: 'C',
        destination: 'D',
        status: 'pending',
        timestamp: 200,
        originTokenAddressOrDenom: 'denom2',
      },
    ];

    render(<SideBarMenu isOpen={true} onClose={onClose} onClickConnectWallet={onConnect} />);

    // amounts '2' should appear before '1' due to sorting by timestamp desc
    const amountNodes = screen.getAllByText(/^[12]$/);
    expect(amountNodes.length).toBeGreaterThanOrEqual(2);
    expect(amountNodes[0].textContent).toBe('2');
    expect(amountNodes[1].textContent).toBe('1');

    // Reset button should be visible and call resetTransfers
    const resetBtn = screen.getByText('Reset transaction history').closest('button');
    expect(resetBtn).not.toBeNull();
    fireEvent.click(resetBtn!);
    expect(resetFn).toHaveBeenCalled();
  });

  it('opens TransfersDetailsModal when a transfer is clicked', () => {
    const onClose = vi.fn();
    const onConnect = vi.fn();

    currentStore.transfers = [
      {
        amount: '5',
        origin: 'X',
        destination: 'Y',
        status: 'pending',
        timestamp: 300,
        originTokenAddressOrDenom: 'denomX',
      },
    ];

    render(<SideBarMenu isOpen={true} onClose={onClose} onClickConnectWallet={onConnect} />);

    const transferButton = screen.getByText('5').closest('button') as HTMLButtonElement;
    expect(transferButton).not.toBeNull();
    fireEvent.click(transferButton!);

    // Modal should appear with the amount shown by our mocked modal
    expect(screen.getByTestId('transfers-modal')).toBeDefined();
    expect(screen.getByTestId('transfers-modal').textContent).toContain('5');
  });
});
