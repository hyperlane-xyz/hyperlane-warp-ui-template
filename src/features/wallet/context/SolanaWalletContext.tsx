import { SnapWalletAdapter } from '@drift-labs/snap-wallet-adapter';
import { WalletAdapterNetwork, WalletError } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

import '@solana/wallet-adapter-react-ui/styles.css';
import {
  LedgerWalletAdapter,
  SalmonWalletAdapter,
  SolflareWalletAdapter,
  TrustWalletAdapter,
  PhantomWalletAdapter,
  BackpackWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { PropsWithChildren, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';

import { logger } from '../../../utils/logger';
import { E2EAutoConnectSolana } from '../_e2e/E2EAutoConnectSolana';
import { isE2EMode } from '../_e2e/isE2E';
import { MockSolanaAdapter } from '../_e2e/MockSolanaAdapter';

export function SolanaWalletContext({ children }: PropsWithChildren<unknown>) {
  // TODO support multiple networks
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const e2e = isE2EMode();
  const wallets = useMemo(
    () => {
      const real = [
        new PhantomWalletAdapter(),
        new BackpackWalletAdapter(),
        new SolflareWalletAdapter(),
        new SalmonWalletAdapter(),
        new SnapWalletAdapter(),
        new TrustWalletAdapter(),
        new LedgerWalletAdapter(),
      ];
      return e2e ? [new MockSolanaAdapter()] : real;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network, e2e],
  );

  const onError = useCallback((error: WalletError) => {
    logger.error('Error initializing Solana wallet provider', error);
    toast.error('Error preparing Solana wallet');
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} onError={onError} autoConnect>
        <WalletModalProvider>
          {e2e && <E2EAutoConnectSolana />}
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
