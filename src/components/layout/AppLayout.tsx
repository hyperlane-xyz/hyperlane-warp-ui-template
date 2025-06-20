import { MultiProtocolWalletModal } from '@hyperlane-xyz/widgets';
import Head from 'next/head';
import { CSSProperties, PropsWithChildren } from 'react';
import { APP_NAME } from '../../consts/app';
import { config } from '../../consts/config';
import { useStore } from '../../features/store';
import { SideBarMenu } from '../../features/wallet/SideBarMenu';
import { cn } from '../../utils/cn';
import { Footer } from '../nav/Footer';
import { Header } from '../nav/Header';

export function AppLayout({ children }: PropsWithChildren) {
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
        id="app-content"
        className="min-w-screen relative flex h-full min-h-screen w-full flex-col justify-between"
      >
        <LayoutBackground />
        <Header />
        <div className="mx-auto flex max-w-screen-xl grow items-center sm:px-4">
          <main className="my-4 flex w-full flex-1 items-center justify-center">{children}</main>
        </div>
        <Footer />
      </div>

      <MultiProtocolWalletModal
        isOpen={showEnvSelectModal}
        close={() => setShowEnvSelectModal(false)}
        protocols={config.walletProtocols}
      />
      <SideBarMenu
        onClose={() => setIsSideBarOpen(false)}
        isOpen={isSideBarOpen}
        onClickConnectWallet={() => setShowEnvSelectModal(true)}
      />
    </>
  );
}

export function LayoutBackground() {
  return (
    <div>
      <div
        className={cn(
          'fixed right-0 top-0 z-10 aspect-[582/1010] bg-[url("/backgrounds/background-lines.svg")] bg-contain bg-no-repeat',
          'isolate z-[-1000] w-[200vw] max-w-[1010px] sm:w-[150vw] md:w-[125vw] lg:w-full',
        )}
      >
        <div
          className={cn(
            'aspect-square w-[70vw] translate-x-[643px] translate-y-[66px] blur-[250px] sm:blur-[384px] md:w-[367px]',
            'bg-gradient-to-r from-[--gradient-from] via-[--gradient-via] to-[--gradient-to] duration-300 ease-out [transition-property:_--gradient-from,_--gradient-via,_--gradient-to]',
          )}
          style={
            {
              '--gradient-from': '#FA43BD',
              '--gradient-via': '#FFA930',
              '--gradient-to': '#FFFFFF',
            } as CSSProperties
          }
        />
      </div>
      <div className="bg-secondary fixed inset-0 z-0 h-full w-full" />
    </div>
  );
}
