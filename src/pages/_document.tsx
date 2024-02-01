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
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#025aa1" />
        <link rel="shortcut icon" href="/favicon.png" />
        <meta name="msapplication-TileColor" content="#025aa1" />
        <meta name="theme-color" content="#ffffff" />

        <meta name="application-name" content="Nautilus Bridge" />
        <meta name="keywords" content="Hyperlane Warp Route Nautilus Bridge" />
        <meta name="description" content="Nautilus Bridge - Built with Hyperlane" />

        <meta name="HandheldFriendly" content="true" />
        <meta name="apple-mobile-web-app-title" content="Nautilus Bridge" />
        <meta name="apple-mobile-web-app-capable" content="yes" />

        <meta property="og:url" content="https://warp.hyperlane.xyz" />
        <meta property="og:title" content="Nautilus Bridge" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://warp.hyperlane.xyz/icon.png" />
        <meta property="og:description" content="Nautilus Bridge - Built with Hyperlane" />
      </Head>
      <body className="text-black">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
