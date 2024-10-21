import Head from 'next/head';
import { PropsWithChildren } from 'react';

import { APP_NAME, BACKGROUND_COLOR, BACKGROUND_IMAGE } from '../../consts/app';
import { useStore } from '../../features/store';
import { SideBarMenu } from '../../features/wallet/SideBarMenu';
import { WalletEnvSelectionModal } from '../../features/wallet/WalletEnvSelectionModal';
import { useAccounts } from '../../features/wallet/hooks/multiProtocol';
import { Footer } from '../nav/Footer';
import { Header } from '../nav/Header';

export function AppLayout({ children }: PropsWithChildren) {
  const { readyAccounts } = useAccounts();
  const numReady = readyAccounts.length;

  const { showEnvSelectModal, setShowEnvSelectModal, isSideBarOpen, setIsSideBarOpen } = useStore(
    (s) => ({
      showEnvSelectModal: s.showEnvSelectModal,
      setShowEnvSelectModal: s.setShowEnvSelectModal,
      isSideBarOpen: s.isSideBarOpen,
      setIsSideBarOpen: s.setIsSideBarOpen,
    }),
  );

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
        className="min-w-screen relative flex h-full min-h-screen w-full flex-col justify-between"
      >
        <Header />
        <div className="mx-auto flex max-w-screen-xl grow items-center sm:px-4">
          <main className="my-4 flex w-full flex-1 items-center justify-center">{children}</main>
        </div>
        <Footer />
      </div>

      <WalletEnvSelectionModal
        isOpen={showEnvSelectModal}
        close={() => setShowEnvSelectModal(false)}
      />
      {numReady > 0 && (
        <SideBarMenu
          onClose={() => setIsSideBarOpen(false)}
          isOpen={isSideBarOpen}
          onConnectWallet={() => setShowEnvSelectModal(true)}
        />
      )}
    </>
  );
}

const styles = {
  container: {
    backgroundColor: BACKGROUND_COLOR,
    backgroundImage: BACKGROUND_IMAGE,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  },
};
