import { ProtocolType } from '@hyperlane-xyz/utils';
import { useWalletDetails } from '@hyperlane-xyz/widgets';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMultiProvider } from '../../chains/hooks';

vi.mock('../../components/banner/FormWarningBanner', () => ({
  FormWarningBanner: ({ children, isVisible }: { children: ReactNode; isVisible: boolean }) => (
    <div data-testid="wallet-warning" data-visible={isVisible}>
      {children}
    </div>
  ),
}));

vi.mock('../../chains/hooks', () => ({
  useMultiProvider: vi.fn(),
}));

vi.mock('@hyperlane-xyz/widgets', () => ({
  useWalletDetails: vi.fn(),
  WarningIcon: () => <span data-testid="warning-icon" />,
}));

const mockUseMultiProvider = vi.mocked(useMultiProvider);
const mockUseWalletDetails = vi.mocked(useWalletDetails);
let WalletConnectionWarning: typeof import('../WalletConnectionWarning').WalletConnectionWarning;

describe('WalletConnectionWarning', () => {
  beforeAll(async () => {
    ({ WalletConnectionWarning } = await import('../WalletConnectionWarning'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders matching warning message when wallet and protocol have configured notice', () => {
    const tryGetProtocol = vi.fn().mockReturnValue(ProtocolType.Starknet);
    mockUseMultiProvider.mockReturnValue({ tryGetProtocol } as any);
    mockUseWalletDetails.mockReturnValue({
      [ProtocolType.Starknet]: { name: 'metamask' },
    } as any);

    render(<WalletConnectionWarning origin={'starknet' as ChainName} />);

    expect(tryGetProtocol).toHaveBeenCalledWith('starknet');
    expect(
      screen.getByText(
        'You might need to switch to a funded token in the Metamask Popup when confirming the transaction',
      ),
    ).toBeInTheDocument();
  });

  it('does not display warning when wallet detail is missing for protocol', () => {
    const tryGetProtocol = vi.fn().mockReturnValue(ProtocolType.Starknet);
    mockUseMultiProvider.mockReturnValue({ tryGetProtocol } as any);
    mockUseWalletDetails.mockReturnValue({} as any);

    render(<WalletConnectionWarning origin={'starknet' as ChainName} />);

    expect(
      screen.queryByText(
        'You might need to switch to a funded token in the Metamask Popup when confirming the transaction',
      ),
    ).toBeNull();
  });

  it('does not display warning when protocol has no configured warning', () => {
    const tryGetProtocol = vi.fn().mockReturnValue(ProtocolType.Ethereum);
    mockUseMultiProvider.mockReturnValue({ tryGetProtocol } as any);
    mockUseWalletDetails.mockReturnValue({
      [ProtocolType.Ethereum]: { name: 'metamask' },
    } as any);

    render(<WalletConnectionWarning origin={'ethereum' as ChainName} />);

    expect(
      screen.queryByText(
        'You might need to switch to a funded token in the Metamask Popup when confirming the transaction',
      ),
    ).toBeNull();
  });
});
