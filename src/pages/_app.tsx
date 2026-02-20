import { useIsSsr } from '@hyperlane-xyz/widgets';
import '@hyperlane-xyz/widgets/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import type { AppProps } from 'next/app';
import { ToastContainer, Zoom } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../../sentry.client.config';
import { ErrorBoundary } from '../components/errors/ErrorBoundary';
import { AppLayout } from '../components/layout/AppLayout';
import { WarpContextInitGate } from '../features/WarpContextInitGate';
import { AleoWalletContext } from '../features/wallet/context/AleoWalletContext';
import { CosmosWalletContext } from '../features/wallet/context/CosmosWalletContext';
import { EvmWalletContext } from '../features/wallet/context/EvmWalletContext';
import { RadixWalletContext } from '../features/wallet/context/RadixWalletContext';
import { SolanaWalletContext } from '../features/wallet/context/SolanaWalletContext';
import { StarknetWalletContext } from '../features/wallet/context/StarknetWalletContext';
import '../styles/globals.css';
import '../vendor/inpage-metamask';
import '../vendor/polyfill';

const reactQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export default function App({ Component, pageProps }: AppProps) {
  // Disable app SSR for now as it's not needed and
  // complicates wallet and graphql integrations
  const isSsr = useIsSsr();
  if (isSsr) {
    return <div></div>;
  }

  return (
    <div className="font-primary text-black">
      <ErrorBoundary>
        <QueryClientProvider client={reactQueryClient}>
          <WarpContextInitGate>
            <EvmWalletContext>
              <SolanaWalletContext>
                <CosmosWalletContext>
                  <StarknetWalletContext>
                    <RadixWalletContext>
                      <AleoWalletContext>
                        <AppLayout>
                          <Component {...pageProps} />
                          <Analytics />
                        </AppLayout>
                      </AleoWalletContext>
                    </RadixWalletContext>
                  </StarknetWalletContext>
                </CosmosWalletContext>
              </SolanaWalletContext>
            </EvmWalletContext>
          </WarpContextInitGate>
        </QueryClientProvider>
        <ToastContainer transition={Zoom} position="bottom-right" limit={2} />
      </ErrorBoundary>
    </div>
  );
}
