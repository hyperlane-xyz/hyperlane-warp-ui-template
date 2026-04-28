import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect } from 'react';

const MOCK_WALLET_NAME = 'WarpE2EMock';

export function E2EAutoConnectSolana() {
  const { wallets, select, wallet } = useWallet();

  // Select the mock adapter once it's registered. After selection, the
  // WalletProvider's autoConnect={true} prop takes over and fires
  // adapter.connect() for us — which ensures WalletProviderBase's 'connect'
  // event handler is subscribed before the emit (the effect order is
  // parent-subscribes → parent-autoConnect; a manual connect() from this
  // child effect would race ahead of the subscribe and the resulting event
  // would be dropped on the floor, leaving publicKey null).
  useEffect(() => {
    const mock = wallets.find((w) => w.adapter.name === MOCK_WALLET_NAME);
    if (!mock) return;
    if (!wallet || wallet.adapter.name !== MOCK_WALLET_NAME) {
      select(mock.adapter.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets]);

  return null;
}
