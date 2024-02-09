import { Head, Html, Main, NextScript } from 'next/document';

import { APP_BRAND_COLOR, APP_DESCRIPTION, APP_NAME, APP_URL } from '../consts/app';

export default function Document() {
  return (
    <Html>
      <Head>
        <meta charSet="utf-8" />

        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color={APP_BRAND_COLOR} />
        <link rel="shortcut icon" href="/favicon.png" />
        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta name="theme-color" content="#ffffff" />

        <meta name="application-name" content={APP_NAME} />
        <meta name="keywords" content={APP_NAME + ' Hyperlane Token Bridge Interchain App'} />
        <meta name="description" content={APP_DESCRIPTION} />

        <meta name="HandheldFriendly" content="true" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <meta name="apple-mobile-web-app-capable" content="yes" />

        <meta property="og:url" content={APP_URL} />
        <meta property="og:title" content={APP_NAME} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${APP_URL}/logo.png`} />
        <meta property="og:description" content={APP_DESCRIPTION} />
      </Head>
      <body className="text-black">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
