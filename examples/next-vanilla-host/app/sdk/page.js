'use client';

import { HyperlaneWarpWidget } from '@hyperlane-xyz/warp-widget-sdk';
import { useState } from 'react';

const WIDGET_URL = process.env.NEXT_PUBLIC_WIDGET_URL || 'http://localhost:3000/embed';

export default function SdkPage() {
  const [latestEvent, setLatestEvent] = useState('none');

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1>SDK Integration</h1>
      <HyperlaneWarpWidget
        iframeUrl={WIDGET_URL}
        config={{
          theme: {
            accentColor: '#5B46FE',
            accentTo: '#7B68FF',
            backgroundColor: '#F6F7FB',
            cardColor: '#FFFFFF',
          },
          defaults: {
            originChain: 'ethereum',
            destinationChain: 'base',
            originAsset: 'USDC',
            destinationAsset: 'USDC',
          },
        }}
        onEvent={(event) => setLatestEvent(event?.type || 'unknown')}
      />
      <p>
        Latest event: <span data-testid="event-log">{latestEvent}</span>
      </p>
    </main>
  );
}
