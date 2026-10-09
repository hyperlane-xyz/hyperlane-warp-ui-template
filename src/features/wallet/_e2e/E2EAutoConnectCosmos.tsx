import { useWallet } from '@cosmos-kit/react';
import { useEffect } from 'react';

const MOCK_WALLET_NAME = 'warp-e2e-mock-cosmos';

// Cosmos-kit's programmatic connect requires a selected wallet + chain. Unlike
// wagmi / @solana/wallet-adapter, there is no single "top-level connect" call
// because wallets are per-chain. `mainWallet.connect()` calls connectAll but
// defaults to activeOnly — chains only become active when the app actually
// renders them via useChain/useChains, so at mount that list is usually empty
// or limited to cosmoshub. Explicitly connect every registered chain-wallet so
// the UI sees a valid address no matter which cosmos chain the user picks.
export function E2EAutoConnectCosmos() {
  const { mainWallet } = useWallet(MOCK_WALLET_NAME);

  useEffect(() => {
    if (!mainWallet) return;
    const chainWallets = mainWallet.getChainWalletList(false);
    for (const cw of chainWallets) {
      if (cw.isWalletConnected) continue;
      cw.connect().catch(() => {
        /* Auto-connect is best-effort. */
      });
    }
  }, [mainWallet]);

  return null;
}
