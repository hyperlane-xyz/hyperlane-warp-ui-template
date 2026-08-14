import { WalletAdapterNetwork, WalletError, type Adapter } from '@solana/wallet-adapter-base';
import { ConnectionProvider, useWallet, WalletProvider } from '@solana/wallet-adapter-react';
import { useWalletModal, WalletModalProvider } from '@solana/wallet-adapter-react-ui';

import '@solana/wallet-adapter-react-ui/styles.css';
import { clusterApiUrl } from '@solana/web3.js';
import {
  createContext,
  lazy,
  PropsWithChildren,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'react-toastify';

import { logger } from '../../../utils/logger';
import { E2EAutoConnectSolana } from '../_e2e/E2EAutoConnectSolana';
import { isE2EMode } from '../_e2e/isE2E';
import { MockSolanaAdapter } from '../_e2e/MockSolanaAdapter';

const SolanaWalletAdaptersLoader = lazy(() => import('./SolanaWalletAdaptersLoader'));

interface SolanaWalletActivation {
  connect: () => void;
  isLoading: boolean;
}

const SolanaWalletActivationContext = createContext<SolanaWalletActivation | undefined>(undefined);

export function useSolanaWalletActivation(): SolanaWalletActivation {
  const value = useContext(SolanaWalletActivationContext);
  if (!value) throw new Error('Solana wallet activation context is unavailable');
  return value;
}

export function SolanaWalletContext({ children }: PropsWithChildren<unknown>) {
  // TODO support multiple networks
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const e2e = isE2EMode();
  const [wallets, setWallets] = useState<Adapter[]>(() => (e2e ? [new MockSolanaAdapter()] : []));
  const [isLoading, setIsLoading] = useState(false);
  const [connectRequest, setConnectRequest] = useState(0);
  const [shouldLoadWallets, setShouldLoadWallets] = useState(false);
  const pendingConnectRef = useRef(false);

  const connect = useCallback(() => {
    if (wallets.length) {
      setConnectRequest((request) => request + 1);
      return;
    }

    pendingConnectRef.current = true;
    setIsLoading(true);
    setShouldLoadWallets(true);
  }, [wallets.length]);

  const onWalletsLoaded = useCallback((adapters: Adapter[]) => {
    setWallets(adapters);
    setIsLoading(false);
    setShouldLoadWallets(false);
    if (!pendingConnectRef.current) return;
    pendingConnectRef.current = false;
    setConnectRequest((request) => request + 1);
  }, []);

  const onWalletsLoadError = useCallback((error: unknown) => {
    pendingConnectRef.current = false;
    setIsLoading(false);
    setShouldLoadWallets(false);
    logger.error('Error loading Solana wallet adapters', error);
    toast.error('Error preparing Solana wallets');
  }, []);

  useEffect(() => {
    if (e2e || typeof window === 'undefined' || !window.localStorage.getItem('walletName')) return;
    setShouldLoadWallets(true);
  }, [e2e]);

  const onError = useCallback((error: WalletError) => {
    logger.error('Error initializing Solana wallet provider', error);
    toast.error('Error preparing Solana wallet');
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} onError={onError} autoConnect>
        <WalletModalProvider>
          <SolanaWalletActivationBridge
            connect={connect}
            connectRequest={connectRequest}
            isLoading={isLoading}
          >
            {shouldLoadWallets && (
              <Suspense fallback={null}>
                <SolanaWalletAdaptersLoader onError={onWalletsLoadError} onLoad={onWalletsLoaded} />
              </Suspense>
            )}
            {e2e && <E2EAutoConnectSolana />}
            {children}
          </SolanaWalletActivationBridge>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function SolanaWalletActivationBridge({
  children,
  connect,
  connectRequest,
  isLoading,
}: PropsWithChildren<SolanaWalletActivation & { connectRequest: number }>) {
  const { setVisible } = useWalletModal();
  const { wallets } = useWallet();
  const handledRequest = useRef(0);

  useEffect(() => {
    if (!wallets.length || connectRequest <= handledRequest.current) return;
    handledRequest.current = connectRequest;
    setVisible(true);
  }, [connectRequest, setVisible, wallets.length]);

  const value = useMemo(() => ({ connect, isLoading }), [connect, isLoading]);
  return (
    <SolanaWalletActivationContext.Provider value={value}>
      {children}
    </SolanaWalletActivationContext.Provider>
  );
}
