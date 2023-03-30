import Head from 'next/head';
import { PropsWithChildren } from 'react';

import { Footer } from '../nav/Footer';
import { Header } from '../nav/Header';

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <>
      <Head>
        {/* https://nextjs.org/docs/messages/no-document-viewport-meta */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Hyperlane Warp Route Template UI</title>
      </Head>
      <div id="app-content" className="h-full min-h-screen w-full min-w-screen">
        <div className="max-w-screen-xl mx-auto flex flex-col justify-between min-h-screen px-4">
          <Header />
          <main className="w-full flex-1 my-4 flex items-center justify-center">{children}</main>
          <Footer />
        </div>
      </div>
    </>
  );
}
