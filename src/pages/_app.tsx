import { RainbowKitProvider, connectorsForWallets, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import {
  argentWallet,
  coinbaseWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  omniWallet,
  phantomWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AppProps } from 'next/app';
import { ToastContainer, Zoom, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { WagmiConfig, configureChains, createClient as createWagmiClient } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';

import '@hyperlane-xyz/widgets/styles.css';

import { ErrorBoundary } from '../components/errors/ErrorBoundary';
import { AppLayout } from '../components/layout/AppLayout';
import { config } from '../consts/config';
import { getWagmiChainConfig } from '../features/chains/metadata';
import { Color } from '../styles/Color';
import '../styles/fonts.css';
import '../styles/globals.css';
import { useIsSsr } from '../utils/ssr';

const { chains, provider } = configureChains(getWagmiChainConfig(), [publicProvider()]);

const connectorConfig = {
  appName: 'Hyperlane Warp Template',
  chains,
  projectId: config.walletConnectProjectId,
};

const connectors = connectorsForWallets([
  {
    groupName: 'Recommended',
    wallets: [
      metaMaskWallet(connectorConfig),
      injectedWallet(connectorConfig),
      walletConnectWallet(connectorConfig),
      ledgerWallet(connectorConfig),
    ],
  },
  {
    groupName: 'More',
    wallets: [
      coinbaseWallet(connectorConfig),
      omniWallet(connectorConfig),
      rainbowWallet(connectorConfig),
      trustWallet(connectorConfig),
      argentWallet(connectorConfig),
      phantomWallet(connectorConfig),
    ],
  },
]);

const wagmiClient = createWagmiClient({
  autoConnect: true,
  provider,
  connectors,
});

const reactQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export default function App({ Component, pageProps }: AppProps) {
  // Disable app SSR for now as it's not needed and
  // complicates graphql integration
  const isSsr = useIsSsr();
  if (isSsr) {
    return <div></div>;
  }

  return (
    <ErrorBoundary>
      <WagmiConfig client={wagmiClient}>
        <RainbowKitProvider
          chains={chains}
          theme={lightTheme({
            accentColor: Color.primaryBlue,
            borderRadius: 'small',
            fontStack: 'system',
          })}
        >
          <QueryClientProvider client={reactQueryClient}>
            <AppLayout>
              <Component {...pageProps} />
            </AppLayout>
          </QueryClientProvider>
          <ToastContainer transition={Zoom} position={toast.POSITION.BOTTOM_RIGHT} limit={2} />
        </RainbowKitProvider>
      </WagmiConfig>
    </ErrorBoundary>
  );
}
