import Head from 'next/head';
import { PropsWithChildren } from 'react';

import { APP_NAME } from '../../consts/app';
import { Footer } from '../nav/Footer';
import { Header } from '../nav/Header';

export function AppLayout({ children }: PropsWithChildren) {
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
        className="relative flex flex-col justify-between h-full min-h-screen w-full min-w-screen bg-blue-500"
      >
        <Header />
        <div className="sm:px-4 mx-auto grow flex items-center max-w-screen-xl">
          <main className="w-full flex-1 my-4 flex items-center justify-center">{children}</main>
        </div>
        <Footer />
      </div>
    </>
  );
}

const styles = {
  container: {
    backgroundImage: 'url(/backgrounds/lines-bg-top.svg)',
    backgroundSize: '94vw',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center 80px',
  },
};
