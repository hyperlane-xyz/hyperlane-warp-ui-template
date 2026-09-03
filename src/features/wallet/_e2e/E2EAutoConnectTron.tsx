import type { AdapterName } from '@tronweb3/tronwallet-abstract-adapter';
import { useWallet } from '@tronweb3/tronwallet-adapter-react-hooks';
import { useEffect } from 'react';

const MOCK_ADAPTER_NAME = 'WarpE2EMockTron' as AdapterName;

// tronwallet-adapter-react's WalletProvider has its own `autoConnect`, but it
// relies on a localStorage key left behind by a prior manual connection. In a
// clean E2E session that key isn't set, so we explicitly select + connect the
// mock adapter once it's present.
export function E2EAutoConnectTron() {
  const { wallets, wallet, select, connect, connected, connecting } = useWallet();

  useEffect(() => {
    if (connected || connecting) return;
    if (!wallets?.some((w) => w.adapter.name === MOCK_ADAPTER_NAME)) return;
    if (wallet?.adapter.name !== MOCK_ADAPTER_NAME) {
      select(MOCK_ADAPTER_NAME);
      return;
    }
    connect().catch(() => {
      /* Auto-connect is best-effort. */
    });
  }, [wallets, wallet, select, connect, connected, connecting]);

  return null;
}
