'use client';

import { HyperlaneWarpWidget } from '@hyperlane-xyz/warp-widget-sdk';

const WIDGET_URL = process.env.NEXT_PUBLIC_WIDGET_URL || 'http://localhost:3000/embed';
const USDAI_EMBED_URL = `${WIDGET_URL}?accent=%23B09D87&accentTo=%23B09D87&accentSoft=%23E6DDD3&bg=%23F8F8F8&card=%23FFFFFF&text=%232D2A28&border=%23D8D1C9&buttonText=%23FFFFFF&origin=arbitrum&destination=ethereum&originToken=PYUSD&destinationToken=USDC`;

export default function UsdAiShowcasePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        color: '#2D2A28',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        background: '#F5F4F2',
      }}
    >
      <section
        style={{
          borderBottom: '1px solid #D9D4CE',
          height: 58,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px 0 20px',
          background: '#F7F6F4',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <strong style={{ letterSpacing: 0.3, fontSize: 36, fontFamily: 'serif' }}>USD.AI</strong>
          <div style={{ height: 26, width: 1, background: '#D8D2CC' }} />
          <div style={{ display: 'flex', gap: 24, color: '#8E7D6C', fontSize: 13, fontWeight: 600 }}>
            <span>TVL</span>
            <span>APY</span>
            <span>EXP. APY</span>
            <span>FAIR VALUE</span>
          </div>
        </div>
        <button
          type="button"
          style={{
            border: '1px solid #D8D2CC',
            background: '#EFEEEB',
            color: '#8E7D6C',
            padding: '8px 14px',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Connect
        </button>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '58px 1fr',
          minHeight: 'calc(100vh - 58px)',
        }}
      >
        <aside
          style={{
            borderRight: '1px solid #D9D4CE',
            background: '#F7F6F4',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 22,
            gap: 18,
          }}
        >
          <div style={{ width: 22, height: 22, borderRadius: 4, background: '#B09D87' }} />
          <div style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid #C8BFB5' }} />
          <div style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid #C8BFB5' }} />
          <div style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid #C8BFB5' }} />
        </aside>

        <div
          style={{
            maxWidth: 980,
            width: '100%',
            margin: '0 auto',
            padding: '74px 18px',
          }}
        >
          <div
            style={{
              border: '1px solid #BFB7AF',
              background: '#F9F8F7',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
              <button type="button" style={tabStyle(false)}>
                BUY
              </button>
              <button type="button" style={tabStyle(false)}>
                STAKE
              </button>
              <button type="button" style={tabStyle(true)}>
                BRIDGE
              </button>
            </div>

            <div
              style={{
                borderTop: '1px solid #CFC8C1',
                borderBottom: '1px solid #CFC8C1',
                textAlign: 'center',
                padding: '12px 8px',
                fontWeight: 600,
              }}
            >
              Bridging can take up to 15 minutes.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr', minHeight: 486 }}>
              <div style={{ padding: 20 }}>
                <div style={{ border: '1px solid #D4CEC7', background: '#FFFFFF' }}>
                  <HyperlaneWarpWidget iframeUrl={USDAI_EMBED_URL} />
                </div>
              </div>

              <div style={{ borderLeft: '1px solid #CFC8C1', display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    height: 78,
                    borderBottom: '1px solid #CFC8C1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 34,
                    fontWeight: 500,
                  }}
                >
                  Transaction Details
                </div>
                <div style={{ flex: 1, padding: 18, fontSize: 34, color: '#C8C0B8' }}>Bridge USDC</div>
                <button
                  type="button"
                  style={{
                    height: 70,
                    border: 'none',
                    borderTop: '1px solid #CFC8C1',
                    background: '#ECE9E5',
                    color: '#A79D92',
                    fontSize: 34,
                    fontWeight: 700,
                  }}
                >
                  Bridge
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function tabStyle(isActive) {
  return {
    border: 'none',
    borderRight: isActive ? 'none' : '1px solid #CFC8C1',
    borderBottom: '1px solid #CFC8C1',
    background: isActive ? '#B09D87' : '#F9F8F7',
    color: isActive ? '#FFFFFF' : '#A78E77',
    height: 56,
    fontWeight: 700,
    fontSize: 30,
    letterSpacing: 0.8,
  };
}
