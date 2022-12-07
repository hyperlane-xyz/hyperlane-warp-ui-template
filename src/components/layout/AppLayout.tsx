import Head from 'next/head';
import { PropsWithChildren } from 'react';

import { toTitleCase } from '../../utils/string';
import { Footer } from '../nav/Footer';
import { Header } from '../nav/Header';

interface Props {
  pathName: string;
}

export function AppLayout({ pathName, children }: PropsWithChildren<Props>) {
  return (
    <>
      <Head>
        {/* https://nextjs.org/docs/messages/no-document-viewport-meta */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`Hyperlane Token Bridge | ${getHeadTitle(pathName)}`}</title>
      </Head>
      <div id="app-content" className="h-full min-h-screen w-full min-w-screen">
        <div className="max-w-screen-xl mx-auto flex flex-col justify-between min-h-screen px-4">
          <Header />
          <main className="w-full flex-1 my-5 flex items-center justify-center">{children}</main>
          <Footer />
        </div>
      </div>
    </>
  );
}

function getHeadTitle(pathName: string) {
  const segments = pathName.split('/');
  if (segments.length <= 1 || !segments[1]) return 'Home';
  else return toTitleCase(segments[1]);
}
