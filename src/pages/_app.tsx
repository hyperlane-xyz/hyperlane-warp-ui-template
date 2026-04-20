import { SpinnerIcon } from '@hyperlane-xyz/widgets/icons/Spinner';

import '@hyperlane-xyz/widgets/styles.css';
import { useIsSsr } from '@hyperlane-xyz/widgets/utils/ssr';

import '@solana/wallet-adapter-react-ui/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import type { AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { ToastContainer, Zoom } from 'react-toastify';

import 'react-toastify/dist/ReactToastify.css';
import '../../sentry.client.config';
import { ErrorBoundary } from '../components/errors/ErrorBoundary';
import { AppLayout } from '../components/layout/AppLayout';
import { ThemeProvider } from '../features/theme/ThemeContext';
import { WarpContextInitGate } from '../features/WarpContextInitGate';
import { Color } from '../styles/Color';

import '../styles/embed-theme.css';
import { parseEmbedTheme } from '../styles/embedTheme';

import '../styles/globals.css';
import '../vendor/inpage-metamask';
import '../vendor/polyfill';

const WalletProviders = dynamic(
  () => import('../features/wallet/WalletProviders').then((mod) => mod.WalletProviders),
  {
    loading: () => (
      <div className="warp-init-gate flex h-screen items-center justify-center">
        <SpinnerIcon
          width={80}
          height={80}
          color={`var(--embed-accent, ${Color.primary['500']})`}
        />
      </div>
    ),
    ssr: false,
  },
);

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
            <WalletProviders>
              <ThemeProvider>{content}</ThemeProvider>
            </WalletProviders>
          </WarpContextInitGate>
        </QueryClientProvider>
        <ToastContainer transition={Zoom} position="bottom-right" limit={2} />
      </ErrorBoundary>
    </div>
  );
}
