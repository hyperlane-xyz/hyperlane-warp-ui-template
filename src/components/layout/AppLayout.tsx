import Head from 'next/head';
import { PropsWithChildren, useCallback, useEffect, useState } from 'react';
import {
  APP_NAME,
  DEFAULT_UI_THEME_MODE,
  getSystemUiThemeMode,
  parseUiThemeMode,
  UI_THEME_STORAGE_KEY,
  UiThemeMode,
} from '../../consts/app';
import { config } from '../../consts/config';
import { initIntercom } from '../../features/analytics/intercom';
import { initRefiner } from '../../features/analytics/refiner';
import { EVENT_NAME } from '../../features/analytics/types';
import { useWalletConnectionTracking } from '../../features/analytics/useWalletConnectionTracking';
import { trackEvent } from '../../features/analytics/utils';
import { useStore } from '../../features/store';
import { SideBarMenu } from '../../features/wallet/SideBarMenu';
import { WalletProtocolModal } from '../../features/wallet/WalletProtocolModal';
import { processDarkLogoImage } from '../../utils/imageBrightness';
import { Footer } from '../nav/Footer';
import { Header } from '../nav/Header';

function getStoredThemeMode(): UiThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseUiThemeMode(window.localStorage.getItem(UI_THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

function persistThemeMode(mode: UiThemeMode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UI_THEME_STORAGE_KEY, mode);
  } catch {
    // Keep theme toggle working for this session when storage is unavailable.
  }
}

export function AppLayout({ children }: PropsWithChildren) {
  const { showEnvSelectModal, setShowEnvSelectModal, isSideBarOpen, setIsSideBarOpen } = useStore(
    (s) => ({
      showEnvSelectModal: s.showEnvSelectModal,
      setShowEnvSelectModal: s.setShowEnvSelectModal,
      isSideBarOpen: s.isSideBarOpen,
      setIsSideBarOpen: s.setIsSideBarOpen,
    }),
  );

  const [themeMode, setThemeMode] = useState<UiThemeMode>(() => {
    if (typeof window === 'undefined') return DEFAULT_UI_THEME_MODE;
    const docTheme = parseUiThemeMode(document.documentElement.dataset.themeMode);
    if (docTheme) return docTheme;
    const storedTheme = getStoredThemeMode();
    return storedTheme ?? getSystemUiThemeMode();
  });
  const [hasExplicitThemePreference, setHasExplicitThemePreference] = useState(() => {
    return getStoredThemeMode() !== null;
  });

  const toggleThemeMode = useCallback(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.dataset.themeSwitching = 'true';
    setThemeMode((prevThemeMode) => {
      const nextMode: UiThemeMode = prevThemeMode === 'dark' ? 'light' : 'dark';
      persistThemeMode(nextMode);
      return nextMode;
    });
    setHasExplicitThemePreference(true);
  }, []);

  useWalletConnectionTracking();

  useEffect(() => {
    initIntercom();
    initRefiner();
    trackEvent(EVENT_NAME.PAGE_VIEWED, {});
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.dataset.themeMode = themeMode;
    const knownLogoImages = document.querySelectorAll(
      'img[data-logo-handlers-bound="true"], img[data-logo-original-src], img[data-logo-dark-src]',
    );
    knownLogoImages.forEach((img) => processDarkLogoImage(img as HTMLImageElement));

    const frame = window.requestAnimationFrame(() => {
      delete document.documentElement.dataset.themeSwitching;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // If user has explicit preference, do not sync to system changes.
    if (hasExplicitThemePreference) return;
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      const nextMode: UiThemeMode = event.matches ? 'dark' : 'light';
      setThemeMode(nextMode);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [hasExplicitThemePreference]);

  return (
    <>
      <Head>
        {/* https://nextjs.org/docs/messages/no-document-viewport-meta */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{APP_NAME}</title>
      </Head>
      <div
        style={styles.container}
        id="app-content"
        data-theme-mode={themeMode}
        suppressHydrationWarning
        className="min-w-screen relative flex h-full min-h-screen w-full flex-col justify-between"
      >
        <Header themeMode={themeMode} onToggleTheme={toggleThemeMode} />
        <div className="mx-auto flex max-w-screen-xl grow items-center sm:px-4">
          <main className="my-4 flex w-full flex-1 items-center justify-center">{children}</main>
        </div>
        <Footer />
      </div>

      <WalletProtocolModal
        isOpen={showEnvSelectModal}
        close={() => setShowEnvSelectModal(false)}
        protocols={config.walletProtocols}
        onProtocolSelected={(protocol) =>
          trackEvent(EVENT_NAME.WALLET_CONNECTION_INITIATED, { protocol })
        }
      />
      <SideBarMenu
        onClose={() => setIsSideBarOpen(false)}
        isOpen={isSideBarOpen}
        onClickConnectWallet={() => setShowEnvSelectModal(true)}
      />
    </>
  );
}

const styles = {
  container: {
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  },
};
