'use client';

import { HyperlaneWarpWidget } from '@hyperlane-xyz/warp-widget-sdk';

const WIDGET_URL = process.env.NEXT_PUBLIC_WIDGET_URL || 'http://localhost:3000/embed';
const MANTRA_EMBED_URL = `${WIDGET_URL}?accent=%23F93FA8&accentTo=%23C040F7&accentSoft=%23FFD1EA&bg=%23FFF6FB&card=%23FFFFFF&text=%232A2035&border=%23F6C9E8&buttonText=%23FFFFFF&origin=base&destination=mantra&originToken=USDC&destinationToken=mantraUSD`;

export default function MantraUsdShowcasePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        color: '#1f1f1f',
        background:
          'radial-gradient(120% 80% at 60% -10%, #b5e9ff 0%, #fbe8f3 45%, #f7d5eb 100%)',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      <section
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '56px 24px 80px',
          display: 'grid',
          gap: 28,
          gridTemplateColumns: '1.1fr 1fr',
          alignItems: 'start',
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            mantraUSD mock integration
          </p>
          <h1 style={{ margin: '10px 0 16px', fontSize: 52, lineHeight: 1.03 }}>
            RWA Utility Money
          </h1>
          <p style={{ margin: 0, maxWidth: 460, fontSize: 18, lineHeight: 1.6 }}>
            A pastel-forward landing shell inspired by mantraUSD, with the warp embed themed to fit.
          </p>
        </div>
        <div
          style={{
            background: 'rgba(255,255,255,0.62)',
            border: '1px solid rgba(255,255,255,0.75)',
            borderRadius: 20,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 18px 55px rgba(93,20,72,0.18)',
            padding: 14,
          }}
        >
          <HyperlaneWarpWidget
            iframeUrl={MANTRA_EMBED_URL}
          />
        </div>
      </section>
    </main>
  );
}
