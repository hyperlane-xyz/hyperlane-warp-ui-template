import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AppProps } from 'next/app';
import { ToastContainer, Zoom, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import '@hyperlane-xyz/widgets/styles.css';

import { ErrorBoundary } from '../components/errors/ErrorBoundary';
import { AppLayout } from '../components/layout/AppLayout';
import { EvmWalletContext } from '../features/wallet/EvmWalletContext';
import { SolanaWalletContext } from '../features/wallet/SolanaWalletContext';
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
      <EvmWalletContext>
        <SolanaWalletContext>
          <QueryClientProvider client={reactQueryClient}>
            <AppLayout>
              <Component {...pageProps} />
            </AppLayout>
          </QueryClientProvider>
          <ToastContainer transition={Zoom} position={toast.POSITION.BOTTOM_RIGHT} limit={2} />
        </SolanaWalletContext>
      </EvmWalletContext>
    </ErrorBoundary>
  );
}
