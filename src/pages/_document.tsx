import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <meta charSet="utf-8" />

        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#31D99C" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <meta name="msapplication-TileColor" content="#31D99C" />
        <meta name="theme-color" content="#ffffff" />

        <meta name="application-name" content="Hyperlane Nexus Bridge" />
        <meta
          name="keywords"
          content="Hyperlane Neutron Manta Nexus Warp Route Token Bridge Interchain App"
        />
        <meta
          name="description"
          content="Nexus is the interface for navigating the modular world. Bridge between any chains that are part of the expanding Modular universe. Built on Hyperlane."
        />

        <meta name="HandheldFriendly" content="true" />
        <meta name="apple-mobile-web-app-title" content="Hyperlane Nexus" />
        <meta name="apple-mobile-web-app-capable" content="yes" />

        <meta property="og:url" content="https://usenexus.org" />
        <meta property="og:title" content="Hyperlane Nexus" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://hyperlane.xyz/logo.png" />
        <meta
          property="og:description"
          content="Nexus is the interface for navigating the modular world. Bridge between any chains that are part of the expanding Modular universe. Built on Hyperlane."
        />
      </Head>
      <body className="text-black">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
