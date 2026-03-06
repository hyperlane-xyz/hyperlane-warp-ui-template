'use client';

import { createWarpIframe } from '@hyperlane-xyz/warp-widget-sdk';
import { useEffect, useRef, useState } from 'react';

const WIDGET_URL = process.env.NEXT_PUBLIC_WIDGET_URL || 'http://localhost:3000/embed';

export default function IframePage() {
  const containerRef = useRef(null);
  const [latestEvent, setLatestEvent] = useState('none');

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const iframe = createWarpIframe(containerRef.current, {
      iframeUrl: WIDGET_URL,
      config: {
        theme: { accentColor: '#5B46FE' },
        defaults: { originChain: 'ethereum', destinationChain: 'base' },
      },
      onEvent: (event) => setLatestEvent(event?.type || 'unknown'),
    });

    return () => iframe.destroy();
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1>Iframe Integration</h1>
      <div ref={containerRef} data-testid="iframe-container" />
      <p>
        Latest event: <span data-testid="iframe-event-log">{latestEvent}</span>
      </p>
    </main>
  );
}
