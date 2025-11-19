import * as utils from '@hyperlane-xyz/utils';
import * as widgetsHooks from '@hyperlane-xyz/widgets';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../../consts/config';
import { logger } from '../../../utils/logger';
import { ChainWalletWarning } from './../ChainWalletWarning';
import * as multiProviderHooks from './../hooks';

// Mock dependencies
vi.mock('@hyperlane-xyz/widgets');
vi.mock('./../hooks');
vi.mock('@hyperlane-xyz/utils');
vi.mock('../../../consts/config', () => ({
  config: {
    chainWalletWhitelists: {},
  },
}));
vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('./../utils', () => ({
  getChainDisplayName: vi.fn((mp, origin) => `${origin} Display Name`),
}));

const MOCK_CHAIN_ORIGIN = 'testchain';
const MOCK_PROTOCOL = 'ethereum';
const MOCK_METAMASK_WALLET_NAME = 'MetaMask';
const MOCK_COINBASE_WALLET_NAME = 'Coinbase Wallet';
const MOCK_WALLET_CONNECT_NAME = 'WalletConnect';

describe('ChainWalletWarning', () => {
  const mockMultiProvider = {
    tryGetProtocol: vi.fn(),
  };

  const mockConnectFn = vi.fn();
  const mockDisconnectFn = vi.fn();

  const mockUseWalletDetails = (walletName?: string) => {
    vi.mocked(widgetsHooks.useWalletDetails).mockReturnValue({
      [MOCK_PROTOCOL]: walletName ? { name: walletName } : {},
    } as any); // Cast to any to satisfy Record<ProtocolType, WalletDetails>
  };

  const mockUseConnectFns = (connectFn: any) => {
    vi.mocked(widgetsHooks.useConnectFns).mockReturnValue({
      [MOCK_PROTOCOL]: connectFn,
    } as any);
  };

  const mockUseDisconnectFns = (disconnectFn: any) => {
    vi.mocked(widgetsHooks.useDisconnectFns).mockReturnValue({
      [MOCK_PROTOCOL]: disconnectFn,
    } as any);
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(multiProviderHooks.useMultiProvider).mockReturnValue(mockMultiProvider as any);
    mockUseWalletDetails(); // Default to no wallet details
    mockUseConnectFns(undefined);
    mockUseDisconnectFns(undefined);
    vi.mocked(utils.toTitleCase).mockImplementation(
      (str) => str.charAt(0).toUpperCase() + str.slice(1),
    );

    mockMultiProvider.tryGetProtocol.mockReturnValue(MOCK_PROTOCOL);
    mockConnectFn.mockResolvedValue(undefined);
    mockDisconnectFn.mockResolvedValue(undefined);
    config.chainWalletWhitelists = {}; // Reset whitelist for each test
  });

  const renderWarning = (origin: string = MOCK_CHAIN_ORIGIN) =>
    render(<ChainWalletWarning origin={origin} />);

  const getWarningContainer = () =>
    screen.queryByText(/requires one of the following wallets/i)?.parentElement?.parentElement;

  const expectNoWarning = () => {
    const container = getWarningContainer();
    if (!container) return;
    expect(container).toHaveClass('max-h-0', { exact: false });
    expect(container).not.toHaveClass('max-h-28', { exact: false });
  };

  describe.skip('should not render warning', () => {
    it.each([
      {
        name: 'when protocol is not found',
        setup: () => mockMultiProvider.tryGetProtocol.mockReturnValue(null),
      },
      {
        name: 'when no whitelist is configured',
        setup: () => (config.chainWalletWhitelists = {}),
      },
      {
        name: 'when whitelist is empty',
        setup: () => (config.chainWalletWhitelists = { [MOCK_CHAIN_ORIGIN]: [] }),
      },
      {
        name: 'when wallet is in whitelist',
        setup: () => {
          config.chainWalletWhitelists = {
            [MOCK_CHAIN_ORIGIN]: [MOCK_METAMASK_WALLET_NAME, MOCK_WALLET_CONNECT_NAME],
          };
          mockUseWalletDetails(MOCK_METAMASK_WALLET_NAME);
        },
      },
      {
        name: 'when wallet name is empty',
        setup: () => {
          config.chainWalletWhitelists = { [MOCK_CHAIN_ORIGIN]: [MOCK_METAMASK_WALLET_NAME] };
          mockUseWalletDetails('');
        },
      },
      {
        name: 'when wallet name is undefined',
        setup: () => {
          config.chainWalletWhitelists = { [MOCK_CHAIN_ORIGIN]: [MOCK_METAMASK_WALLET_NAME] };
          mockUseWalletDetails(undefined);
        },
      },
      {
        name: 'when handling case-insensitive wallet name matching',
        setup: () => {
          config.chainWalletWhitelists = { [MOCK_CHAIN_ORIGIN]: [MOCK_METAMASK_WALLET_NAME] };
          mockUseWalletDetails('  METAMASK  '); // with spaces and uppercase
        },
      },
      {
        name: 'when handling whitespace in whitelist entries',
        setup: () => {
          config.chainWalletWhitelists = {
            [MOCK_CHAIN_ORIGIN]: ['  MetaMask  ', MOCK_WALLET_CONNECT_NAME],
          };
          mockUseWalletDetails('metamask');
        },
      },
    ])('$name', ({ setup }) => {
      setup();
      renderWarning();
      expectNoWarning();
    });
  });

  it.skip('should render warning when wallet is not in whitelist', () => {
    config.chainWalletWhitelists = {
      [MOCK_CHAIN_ORIGIN]: [MOCK_METAMASK_WALLET_NAME, MOCK_WALLET_CONNECT_NAME],
    };

    mockUseWalletDetails(MOCK_COINBASE_WALLET_NAME);

    renderWarning();

    const container = getWarningContainer();
    expect(container).toBeDefined();
    expect(container).toHaveClass('max-h-28', { exact: false });
    expect(container).toHaveTextContent(
      /testchain Display Name requires one of the following wallets: Metamask, Walletconnect/i,
    );
  });

  it('should call disconnect then connect when Change button is clicked', async () => {
    config.chainWalletWhitelists = { [MOCK_CHAIN_ORIGIN]: [MOCK_METAMASK_WALLET_NAME] };

    mockUseWalletDetails(MOCK_COINBASE_WALLET_NAME);
    mockUseConnectFns(mockConnectFn);
    mockUseDisconnectFns(mockDisconnectFn);

    renderWarning();

    const changeButton = screen.getByText('Change');
    fireEvent.click(changeButton);

    await vi.waitFor(() => {
      expect(mockDisconnectFn).toHaveBeenCalledTimes(1);
    });

    await vi.waitFor(() => {
      expect(mockConnectFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('should not call functions when Change is clicked but a function is missing', () => {
    it.each([
      {
        name: 'connectFn is missing',
        setup: () => {
          mockUseConnectFns(undefined);
          mockUseDisconnectFns(mockDisconnectFn);
        },
      },
      {
        name: 'disconnectFn is missing',
        setup: () => {
          mockUseConnectFns(mockConnectFn);
          mockUseDisconnectFns(undefined);
        },
      },
    ])('$name', ({ setup }) => {
      config.chainWalletWhitelists = { [MOCK_CHAIN_ORIGIN]: [MOCK_METAMASK_WALLET_NAME] };
      mockUseWalletDetails(MOCK_COINBASE_WALLET_NAME);
      setup();

      renderWarning();

      const changeButton = screen.getByText('Change');
      fireEvent.click(changeButton);

      expect(mockDisconnectFn).not.toHaveBeenCalled();
      expect(mockConnectFn).not.toHaveBeenCalled();
    });
  });

  describe.skip('should log error when wallet connection fails', () => {
    it.each([
      {
        name: 'when disconnect fails',
        error: new Error('Disconnect failed'),
        mockFn: mockDisconnectFn,
        expectConnectNotCalled: true,
      },
      {
        name: 'when connect fails',
        error: new Error('Connect failed'),
        mockFn: mockConnectFn,
        expectConnectNotCalled: false,
      },
    ])('$name', async ({ error, mockFn, expectConnectNotCalled }) => {
      mockFn.mockRejectedValue(error);

      config.chainWalletWhitelists = { [MOCK_CHAIN_ORIGIN]: [MOCK_METAMASK_WALLET_NAME] };

      mockUseWalletDetails(MOCK_COINBASE_WALLET_NAME);
      mockUseConnectFns(mockConnectFn);
      mockUseDisconnectFns(mockDisconnectFn);

      renderWarning();

      const changeButton = screen.getByText('Change');
      fireEvent.click(changeButton);

      await vi.waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('Error changing wallet connection', error);
      });

      if (expectConnectNotCalled) {
        expect(mockConnectFn).not.toHaveBeenCalled();
      }
    });
  });

  it('should format multiple whitelisted wallets correctly', () => {
    config.chainWalletWhitelists = {
      [MOCK_CHAIN_ORIGIN]: ['metamask', 'walletconnect', 'coinbase wallet'],
    };

    mockUseWalletDetails('Trust Wallet');

    renderWarning();

    const container = getWarningContainer();
    expect(container).toBeDefined();
    expect(container).toHaveTextContent(/Metamask, Walletconnect, Coinbase wallet/i);
  });

  it.skip('should not render when wallet name is empty', () => {
    config.chainWalletWhitelists = { [MOCK_CHAIN_ORIGIN]: [MOCK_METAMASK_WALLET_NAME] };

    mockUseWalletDetails('');

    renderWarning();

    expectNoWarning();
  });

  it.skip('should not render when wallet name is undefined', () => {
    config.chainWalletWhitelists = { [MOCK_CHAIN_ORIGIN]: [MOCK_METAMASK_WALLET_NAME] };

    mockUseWalletDetails(undefined);

    renderWarning();

    expectNoWarning();
  });
});
