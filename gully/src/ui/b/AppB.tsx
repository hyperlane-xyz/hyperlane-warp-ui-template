// Direction B: consumer swap-style card under a big animated route visual, live transfers feed.
import { useEffect, useRef, useState } from 'react';

import { CHAINS } from '../../config/chains';
import { duration } from '../../bridge/format';
import type { ActivityItem } from '../../bridge/types';
import { Icon } from '../common/icons';
import { Money, UsdLine, UsdNote } from '../common/money';
import { asEth, ethN } from '../../bridge/usd';
import { ActionButton, ActivityList, AmountField, ChainMark, Footer, LegacyNotice, MirrorNotice, MyTransfers, QuoteDetails, Stepper } from '../common/parts';
import { Header } from '../common/shell';
import { useActivity, useBridge, useHeads, type BridgeState, type UrlOptions } from '../useBridge';

export function AppB({ url }: { url: UrlOptions }) {
  const b = useBridge(url);
  const heads = useHeads();
  const act = useActivity();

  const card = <SwapCard b={b} />;

  if (url.embed)
    return (
      <div className="embed b">
        {card}
        <Footer minimal />
      </div>
    );

  return (
    <div className="b">
      <a className="skip" href="#bridge">
        Skip to the bridge
      </a>
      <Header className="top-b" />
      <main>
        <section className="hero-b" aria-label="Route">
          <RouteVisual b={b} items={act.items} heads={heads} />
        </section>
        <div className="wrap-b">
          {card}
          <MyTransfers b={b} />
          <section className="feed-b" id="activity" aria-label="Live transfers">
            <h2 className="label">
              <span className="live-dot" /> Live transfers
            </h2>
            <FeedCards items={act.items} />
            <ActivityList items={act.items} error={act.error} limit={6} preview={url.preview} />
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function LaneToggle({ b }: { b: BridgeState }) {
  return (
    <div className="lane" role="radiogroup" aria-label="Route">
      {(['fast', 'canonical'] as const).map((k) => (
        <button key={k} role="radio" aria-checked={b.kind === k} className={`lane-b ${b.kind === k ? 'lane-on' : ''}`} onClick={() => b.setKind(k === b.pick.kind ? undefined : k)}>
          <Icon name={k === 'fast' ? 'zap' : 'shield'} size={16} />
          {k === 'fast' ? 'Fast' : 'Canonical'}
          {b.pick.kind === k && <i className="lane-best" title={b.pick.reason} />}
        </button>
      ))}
    </div>
  );
}

/** Big animated route: two chain nodes, a fast arc and a canonical arc, packets for real transfers. */
export function RouteVisual({ b, items, heads }: { b: BridgeState; items?: ActivityItem[]; heads: ReturnType<typeof useHeads> }) {
  const [bursts, setBursts] = useState<{ id: string; kind: 'fast' | 'canonical'; dir: 'deposit' | 'withdraw' }[]>([]);
  const seen = useRef(new Set<string>());
  useEffect(() => {
    if (!items) return;
    const fresh = items.filter((i) => !seen.current.has(i.key));
    items.forEach((i) => seen.current.add(i.key));
    if (!fresh.length) return;
    const add = fresh.slice(0, 6).map((i) => ({ id: i.key, kind: i.kind, dir: i.direction }));
    setBursts((x) => [...x, ...add].slice(-10));
    const t = setTimeout(() => setBursts((x) => x.filter((y) => !add.includes(y))), 4000);
    return () => clearTimeout(t);
  }, [items]);
  const rev = b.direction === 'withdraw';
  const fastPath = 'M150 170 C 330 20, 670 20, 850 170';
  const canonPath = 'M150 190 C 330 330, 670 330, 850 190';
  return (
    <div className="rv">
      <svg viewBox="0 0 1000 340" className="rv-svg" role="img" aria-label={`${b.kind === 'fast' ? 'Fast' : 'Canonical'} route from ${CHAINS[b.from].name} to ${CHAINS[b.to].name}`}>
        <defs>
          <linearGradient id="gcg" x1="0" x2="1">
            <stop offset="0" style={{ stopColor: 'var(--gn-cyan)' }} />
            <stop offset="1" style={{ stopColor: 'var(--gn-green)' }} />
          </linearGradient>
          <radialGradient id="glow">
            <stop offset="0" style={{ stopColor: 'var(--gn-cyan)', stopOpacity: 0.35 }} />
            <stop offset="1" style={{ stopColor: 'var(--gn-cyan)', stopOpacity: 0 }} />
          </radialGradient>
          <path id="pf" d={fastPath} />
          <path id="pc" d={canonPath} />
        </defs>
        <use href="#pf" className={`rv-arc rv-fast ${b.kind === 'fast' ? 'rv-on' : ''}`} />
        <use href="#pc" className={`rv-arc rv-canon ${b.kind === 'canonical' ? 'rv-on' : ''}`} />
        {[0, 1, 2, 3].map((n) => (
          <circle key={`f${n}`} r={b.kind === 'fast' ? 6 : 4} className="rv-pkt rv-pkt-fast">
            <animateMotion dur="2.4s" begin={`${n * 0.6}s`} repeatCount="indefinite" keyPoints={rev ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear">
              <mpath href="#pf" />
            </animateMotion>
          </circle>
        ))}
        {[0, 1].map((n) => (
          <circle key={`c${n}`} r={b.kind === 'canonical' ? 6 : 4} className="rv-pkt rv-pkt-canon">
            <animateMotion dur="9s" begin={`${n * 4.5}s`} repeatCount="indefinite" keyPoints={rev ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear">
              <mpath href="#pc" />
            </animateMotion>
          </circle>
        ))}
        {bursts.map((x) => (
          <circle key={x.id} r="9" className={`rv-burst rv-pkt-${x.kind === 'fast' ? 'fast' : 'canon'}`}>
            <animateMotion dur={x.kind === 'fast' ? '1.6s' : '3.6s'} repeatCount="1" fill="freeze" keyPoints={x.dir === 'withdraw' ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear">
              <mpath href={x.kind === 'fast' ? '#pf' : '#pc'} />
            </animateMotion>
          </circle>
        ))}
        <text x="500" y="58" className="rv-lab rv-lab-fast" textAnchor="middle">
          FAST · ~1 MIN
        </text>
        <text x="500" y="300" className="rv-lab" textAnchor="middle">
          CANONICAL · {b.direction === 'deposit' ? '~1 MIN' : 'CHALLENGE + CLAIM'}
        </text>
        <circle cx="150" cy="180" r="90" fill="url(#glow)" className="rv-pulse" />
        <circle cx="850" cy="180" r="90" fill="url(#glow)" className="rv-pulse rv-pulse-2" />
      </svg>
      <div className="rv-node rv-node-l">
        <ChainMark chain="arbitrumsepolia" size={64} />
        <b>Arbitrum Sepolia</b>
        <small className="mono">#{heads.arbitrumsepolia.block?.toString() ?? '…'}</small>
      </div>
      <div className="rv-node rv-node-r">
        <ChainMark chain="gullychaintestnet" size={72} />
        <b>GullyChain</b>
        <small className="mono">#{heads.gullychaintestnet.block?.toString() ?? '…'}</small>
      </div>
    </div>
  );
}

export function FeedCards({ items }: { items?: ActivityItem[] }) {
  if (!items?.length) return null;
  const row = items.slice(0, 12);
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-in">
        {[...row, ...row].map((i, n) => (
          <span key={`${i.key}-${n}`} className={`mcard mcard-${i.kind}`}>
            <Icon name={i.kind === 'fast' ? 'zap' : 'shield'} size={14} />
            <Money v={i.amount} symbol={i.symbol} inline />
            <small>{i.direction === 'deposit' ? 'Arb → Gully' : 'Gully → Arb'}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

/** The swap-style bridge card (used by B and by the hybrid C). */
export function SwapCard({ b, title = 'Bridge' }: { b: BridgeState; title?: string }) {
  return (
    <section className="swap" id="bridge" aria-label="Bridge">
      <div className="swap-head">
        <h1 className="h-card">{title}</h1>
        <LaneToggle b={b} />
      </div>
      <div className="swap-box">
        <div className="swap-chain">
          <ChainMark chain={b.from} size={22} />
          <span>From {CHAINS[b.from].name}</span>
        </div>
        <AmountField b={b} big />
      </div>
      <button className="swap-flip" aria-label="Switch direction" onClick={b.flip}>
        <Icon name="arrowDown" size={20} />
      </button>
      <div className="swap-box swap-to">
        <div className="swap-chain">
          <ChainMark chain={b.to} size={22} />
          <span>To {CHAINS[b.to].name}</span>
        </div>
        <div className="swap-recv">
          <span className={`swap-recv-num ${recvSize(b.quote && b.amount ? ethN(asEth(b.quote.receive)) : '')}`}>{b.quote && b.amount ? ethN(asEth(b.quote.receive)) : '0.0'}</span>
          <span className="token-chip">
            <ChainMark chain={b.to} size={20} />
            {b.quote?.receiveSymbol || 'ETH'}
          </span>
        </div>
        <UsdLine v={b.quote && b.amount ? b.quote.receive : null} className="usd-recv" />
        <small className="muted">
          {b.quote ? `Arrives ${duration(b.quote.etaSeconds)}${b.kind === 'canonical' && b.direction === 'withdraw' ? ', then claim' : ''}` : 'Getting a quote…'}
        </small>
      </div>
      <LegacyNotice b={b} />
      <MirrorNotice b={b} />
      <QuoteDetails b={b} />
      {b.stepDefs.length > 0 && <Stepper defs={b.stepDefs} state={b.steps} compact />}
      <ActionButton b={b} />
      <UsdNote />
    </section>
  
  );
}

/** Font step for the receive amount, like the input's. */
function recvSize(text: string) {
  const n = text.length;
  return n > 16 ? 'amount-xs' : n > 12 ? 'amount-sm' : n > 9 ? 'amount-md' : '';
}
