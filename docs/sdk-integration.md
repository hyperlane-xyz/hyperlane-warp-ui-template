# Warp Widget SDK Integration (Next.js)

This guide shows the concrete SDK integration path for a host app using `@hyperlane-xyz/warp-widget-sdk`.

## What you get

- React component: `HyperlaneWarpWidget`
- Iframe helper: `createWarpIframe`
- Event callback support (currently includes `ready`)

## Prerequisites

- Next.js app (App Router or Pages Router)
- React 18+
- A widget runtime URL (for local dev: `http://localhost:3000/embed`)

## 1) Install

```bash
pnpm add @hyperlane-xyz/warp-widget-sdk
```

If you are developing in this monorepo, use workspace linking (`workspace:*`) as shown in the example app.

## 2) Configure widget URL

Add this to your host app `.env.local`:

```bash
NEXT_PUBLIC_WIDGET_URL=http://localhost:3000/embed
```

In production, set it to your hosted widget URL, for example:

```bash
NEXT_PUBLIC_WIDGET_URL=https://<your-widget-domain>/embed
```

## 3) SDK component integration

Create a client component/page (App Router example):

```tsx
'use client';

import { HyperlaneWarpWidget } from '@hyperlane-xyz/warp-widget-sdk';
import { useState } from 'react';

const WIDGET_URL = process.env.NEXT_PUBLIC_WIDGET_URL || 'http://localhost:3000/embed';

export default function SdkIntegrationPage() {
  const [latestEvent, setLatestEvent] = useState('none');

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1>SDK Integration</h1>
      <HyperlaneWarpWidget
        iframeUrl={WIDGET_URL}
        config={{
          theme: { accentColor: '#5B46FE' },
          defaults: { originChain: 'ethereum', destinationChain: 'base' },
        }}
        onEvent={(event) => setLatestEvent(event?.type || 'unknown')}
      />
      <p>
        Latest event: <span data-testid="event-log">{latestEvent}</span>
      </p>
    </main>
  );
}
```

## 4) Optional: direct iframe helper integration

If you prefer imperative mounting:

```tsx
'use client';

import { createWarpIframe } from '@hyperlane-xyz/warp-widget-sdk';
import { useEffect, useRef, useState } from 'react';

const WIDGET_URL = process.env.NEXT_PUBLIC_WIDGET_URL || 'http://localhost:3000/embed';

export default function IframeIntegrationPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [latestEvent, setLatestEvent] = useState('none');

  useEffect(() => {
    if (!containerRef.current) return;

    const instance = createWarpIframe(containerRef.current, {
      iframeUrl: WIDGET_URL,
      config: {
        theme: { accentColor: '#5B46FE' },
        defaults: { originChain: 'ethereum', destinationChain: 'base' },
      },
      onEvent: (event) => setLatestEvent(event?.type || 'unknown'),
    });

    return () => instance.destroy();
  }, []);

  return (
    <main>
      <div ref={containerRef} data-testid="iframe-container" />
      <span data-testid="iframe-event-log">{latestEvent}</span>
    </main>
  );
}
```

## 5) Event model

The host receives events through `onEvent`.

Current event emitted by the runtime:

- `ready`: widget loaded and initialized

Notes:

- Event bridge ignores malformed messages.
- Event bridge ignores messages not coming from the configured widget origin.
- Event bridge ignores messages not coming from the mounted widget iframe window.

## 6) Verify integration locally

This repository includes a concrete host fixture:

- `examples/next-vanilla-host/app/sdk/page.js`
- `examples/next-vanilla-host/app/iframe/page.js`

Run the host integration e2e suite:

```bash
pnpm run test:e2e:host
```

The suite validates:

- SDK host renders widget root and receives `ready`
- iframe helper host receives `ready`
- malformed/untrusted event messages are ignored

## Troubleshooting

- Blank widget area:
  - verify `NEXT_PUBLIC_WIDGET_URL` points to a reachable `/embed` page
  - verify that `/embed` response headers allow framing
- No events in host:
  - ensure `onEvent` is passed
  - ensure widget URL origin matches runtime origin
- Local dev port mismatch:
  - host defaults to `3100`, widget defaults to `3000` in this repo
