import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import type { AppProps } from 'next/app';
import { ToastContainer, Zoom, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'src/vendor/inpage-metamask';
import 'src/vendor/polyfill';

import '@hyperlane-xyz/widgets/styles.css';

import { ErrorBoundary } from '../components/errors/ErrorBoundary';
import { AppLayout } from '../components/layout/AppLayout';
import { WarpContext } from '../context/WarpContext';
import { CosmosWalletContext } from '../features/wallet/context/CosmosWalletContext';
import { EvmWalletContext } from '../features/wallet/context/EvmWalletContext';
import { SolanaWalletContext } from '../features/wallet/context/SolanaWalletContext';
import '../styles/fonts.css';
import '../styles/globals.css';
import { useIsSsr } from '../utils/ssr';

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
      <QueryClientProvider client={reactQueryClient}>
        <WarpContext>
          <EvmWalletContext>
            <SolanaWalletContext>
              <CosmosWalletContext>
                <AppLayout>
                  <Component {...pageProps} />
                  <Analytics />
                </AppLayout>
                <ToastContainer
                  transition={Zoom}
                  position={toast.POSITION.BOTTOM_RIGHT}
                  limit={2}
                />
              </CosmosWalletContext>
            </SolanaWalletContext>
          </EvmWalletContext>
        </WarpContext>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
