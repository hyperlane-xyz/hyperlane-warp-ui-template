import Head from 'next/head';
import dynamic from 'next/dynamic';
import { PropsWithChildren, useEffect } from 'react';

import { APP_NAME } from '../../consts/app';
import { config } from '../../consts/config';
import { initIntercom } from '../../features/analytics/intercom';
import { initRefiner } from '../../features/analytics/refiner';
import { EVENT_NAME } from '../../features/analytics/types';
import { trackEvent } from '../../features/analytics/utils';
import { useStore } from '../../features/store';
import { SideBarMenu } from '../../features/wallet/SideBarMenu';
import { Footer } from '../nav/Footer';
import { Header } from '../nav/Header';

const WalletConnectionTracker = dynamic(
  () =>
    import('../../features/analytics/WalletConnectionTracker').then(
      (mod) => mod.WalletConnectionTracker,
    ),
  { ssr: false },
);

const WalletProtocolModal = dynamic(
  () => import('../../features/wallet/WalletProtocolModal').then((mod) => mod.WalletProtocolModal),
  { ssr: false },
);

export function AppLayout({ children }: PropsWithChildren) {
  const { showEnvSelectModal, setShowEnvSelectModal, isSideBarOpen, setIsSideBarOpen } = useStore(
    (s) => ({
      showEnvSelectModal: s.showEnvSelectModal,
      setShowEnvSelectModal: s.setShowEnvSelectModal,
      isSideBarOpen: s.isSideBarOpen,
      setIsSideBarOpen: s.setIsSideBarOpen,
    }),
  );

  useEffect(() => {
    initIntercom();
    initRefiner();
    trackEvent(EVENT_NAME.PAGE_VIEWED, {});
  }, []);

  return (
    <>
      <Head>
        {/* https://nextjs.org/docs/messages/no-document-viewport-meta */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{APP_NAME}</title>
      </Head>
      <div
        id="app-content"
        className="min-w-screen relative flex h-full min-h-screen w-full flex-col justify-between"
      >
        <WalletConnectionTracker />
        <Header />
        <div className="mx-auto flex max-w-screen-xl grow items-center sm:px-4">
          <main className="my-4 flex w-full flex-1 items-center justify-center">{children}</main>
        </div>
        <Footer />
      </div>

      {showEnvSelectModal ? (
        <WalletProtocolModal
          isOpen={showEnvSelectModal}
          close={() => setShowEnvSelectModal(false)}
          protocols={config.walletProtocols}
          onProtocolSelected={(protocol) =>
            trackEvent(EVENT_NAME.WALLET_CONNECTION_INITIATED, { protocol })
          }
        />
      ) : null}
      <SideBarMenu
        onClose={() => setIsSideBarOpen(false)}
        isOpen={isSideBarOpen}
        onClickConnectWallet={() => setShowEnvSelectModal(true)}
      />
    </>
  );
}
