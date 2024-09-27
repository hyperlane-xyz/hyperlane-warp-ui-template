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
        id="app-content"
        className="relative flex flex-col justify-between h-full min-h-screen w-full min-w-screen"
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

// const styles = {
//   container: {
//     backgroundColor: BACKGROUND_COLOR,
//     backgroundImage: BACKGROUND_IMAGE,
//     backgroundSize: 'cover',
//     backgroundRepeat: 'no-repeat',
//     backgroundPosition: 'center',
//   },
// };
