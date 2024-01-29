import Head from 'next/head';
import Image from 'next/image';
import { PropsWithChildren } from 'react';

import { APP_NAME } from '../../consts/app';
import Planet1 from '../../images/planets/planet-1.webp';
import Planet2 from '../../images/planets/planet-2.webp';
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
        <div className="hidden md:flex absolute left-[8%] top-[15%]">
          <Image src={Planet1} alt="Planet 1" width={200} priority={false} quality={50}></Image>
        </div>
        <div className="hidden md:flex absolute right-[8%] bottom-1/4">
          <Image src={Planet2} alt="Planet 2" width={220} priority={false} quality={50}></Image>
        </div>
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
