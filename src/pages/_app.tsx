import { useIsSsr } from '@hyperlane-xyz/widgets';
import '@hyperlane-xyz/widgets/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { ToastContainer, Zoom } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../../sentry.client.config';
import { ErrorBoundary } from '../components/errors/ErrorBoundary';
import { AppLayout } from '../components/layout/AppLayout';
import { WarpContextInitGate } from '../features/WarpContextInitGate';
import { ThemeProvider } from '../features/theme/ThemeContext';
import { AleoWalletContext } from '../features/wallet/context/AleoWalletContext';
import { CosmosWalletContext } from '../features/wallet/context/CosmosWalletContext';
import { EvmWalletContext } from '../features/wallet/context/EvmWalletContext';
import { RadixWalletContext } from '../features/wallet/context/RadixWalletContext';
import { SolanaWalletContext } from '../features/wallet/context/SolanaWalletContext';
import { StarknetWalletContext } from '../features/wallet/context/StarknetWalletContext';
import { TronWalletContext } from '../features/wallet/context/TronWalletContext';
import '../styles/embed-theme.css';
import { parseEmbedTheme } from '../styles/embedTheme';
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

/**
 * Sets embed-mode class + CSS variables on <body> early so the loading
 * screen (WarpContextInitGate) is also themed.
 */
function useEarlyEmbedMode(isEmbed: boolean) {
  useEffect(() => {
    if (!isEmbed) return;
    document.body.classList.add('embed-mode');
    const theme = parseEmbedTheme();
    const { style } = document.body;
    for (const [key, value] of Object.entries(theme)) {
      const varName = `--embed-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`;
      style.setProperty(varName, value);
    }
    return () => document.body.classList.remove('embed-mode');
  }, [isEmbed]);
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isEmbed = router.pathname === '/embed';

  useEarlyEmbedMode(isEmbed);

  // Disable app SSR for now as it's not needed and
  // complicates wallet and graphql integrations
  const isSsr = useIsSsr();
  if (isSsr) {
    return <div></div>;
  }

  const content = isEmbed ? (
    <Component {...pageProps} />
  ) : (
    <AppLayout>
      <Component {...pageProps} />
      <Analytics />
    </AppLayout>
  );

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
                        <TronWalletContext>
                          <ThemeProvider>{content}</ThemeProvider>
                        </TronWalletContext>
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
