import { useAccount } from '@hyperlane-xyz/widgets/walletIntegrations/radix/AccountContext';
import { useEffect } from 'react';

// Radix account address for E2E. Deterministic, recognisable in traces.
export const MOCK_RADIX_ADDRESS =
  'account_rdx12e2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee2ee';

// The @hyperlane-xyz/widgets Radix AccountContext tracks the connected
// account purely in React state (no adapter/client class). Seeding that state
// at mount is enough for downstream hooks (`useAccount`) to observe a
// connected wallet on the Radix chain.
export function E2EAutoConnectRadix() {
  const { setAccounts, setSelectedAccount, selectedAccount } = useAccount();

  useEffect(() => {
    if (selectedAccount === MOCK_RADIX_ADDRESS) return;
    const mockAccount = {
      address: MOCK_RADIX_ADDRESS,
      label: 'Warp E2E Mock (Radix)',
      appearanceId: 0,
    };
    // The WalletAccount type in widgets expects additional fields but all
    // downstream code paths only read `address` — cast through unknown.
    setAccounts([mockAccount as unknown as Parameters<typeof setAccounts>[0][number]]);
    setSelectedAccount(MOCK_RADIX_ADDRESS);
  }, [selectedAccount, setAccounts, setSelectedAccount]);

  return null;
}
