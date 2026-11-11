import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { CHAINS, CHILD, IS_TESTNET, LINKS, PARENT, txUrl, type ChainKey } from '../../config/chains';
import { CAPS } from '../../config/network';
import { capLines } from '../../bridge/caps';
import { GULLY_CORE_URL } from '../../config/routes';
import { ago, duration, fmtAmount, short } from '../../bridge/format';
import type { ActivityItem, StepDef, TransferRecord } from '../../bridge/types';
import { disconnect, openConnect, startDiscovery } from '../../bridge/wallet';
import '../../gc-connect/gc-connect.js';
import type { BridgeState, StepState } from '../useBridge';
import { useWallet } from '../useBridge';
import { BridgeEarnDelivered } from '../earn/BridgeEarnDeliveredNotice';
import { Icon, type IconName } from './icons';
import { Money, UsdLine } from './money';
import { ethN } from '../../bridge/usd';

/** Signature button: pill, left icon, sliding arrow, shine sweep, 0.98 pressed. */
export function Btn({
  variant = 'primary',
  icon,
  arrow = true,
  busy,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: IconName;
  arrow?: boolean;
  busy?: boolean;
}) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...rest}>
      {busy ? <Icon name="loader" className="spin" /> : icon && <Icon name={icon} />}
      <span>{children}</span>
      {arrow && <Icon name="arrowRight" className="btn-arrow" />}
    </button>
  );
}

/** Gully products are one family: links between them open in the same tab; only truly external links get a new tab. */
export const GULLY_HOST = /(^|\.)(gullychain|gullylabs|gullypay|gullyrpc|holdermaps|gullysecurity|gullystudio|gullyai)\.xyz$/;
export function isGully(href: string) {
  try {
    return GULLY_HOST.test(new URL(href).hostname);
  } catch {
    return true; // relative link
  }
}

// Gully hosts open in the same tab (product navigation), except with `newTab` (explorer tx links: a transfer in
// progress must stay on screen) and inside the embed, where a same-tab link would navigate the integrator's iframe.
export function Ext({ href, children, className, newTab, testId }: { href: string; children: ReactNode; className?: string; newTab?: boolean; testId?: string }) {
  const embedded = typeof document !== 'undefined' && document.documentElement.classList.contains('is-embed');
  if (isGully(href) && !newTab && !embedded)
    return (
      <a href={href} className={className} data-testid={testId}>
        {children}
      </a>
    );
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} data-testid={testId}>
      {children}
    </a>
  );
}

/** Official chain logos from the Gully chain-logo pack (gully-ops design/chains; sources in its SOURCES.md), in
 *  public/chains/. Decorative by default (the chain's name is written next to it); pass alt when it stands alone.
 *  badge: the file with the small amber testnet corner badge, for places that show no "Testnet" text. A file that
 *  fails to load falls back to the chain's short text mark. GullyChain uses the brand kit v4 icon (brand/logo/gc-icon.svg,
 *  byte-identical; its hexagon sits inside the round mask, so nothing is cropped) until the chain-logo pack moves to kit v4. */
const CHAIN_LOGO: Record<ChainKey, { mark: string; badged: string; text: string }> = {
  gullychaintestnet: { mark: 'brand/logo/gc-icon.svg', badged: 'brand/logo/gc-icon.svg', text: 'G' },
  arbitrumsepolia: { mark: 'chains/arbitrum.svg', badged: 'chains/arbitrum-sepolia.svg', text: 'ARB' },
};

export function ChainMark({ chain, size = 28, alt = '', badge = false }: { chain: ChainKey; size?: number; alt?: string; badge?: boolean }) {
  const [broken, setBroken] = useState(false);
  const l = CHAIN_LOGO[chain];
  if (broken)
    return (
      <span className="chain-mark chain-mark-arb" style={{ width: size, height: size, fontSize: size * 0.36 }} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
        {l.text}
      </span>
    );
  return <img className="chain-mark" src={badge && IS_TESTNET ? l.badged : l.mark} width={size} height={size} alt={alt} title={alt || undefined} onError={() => setBroken(true)} />;
}

/** Small "Testnet" badge written after a testnet chain's name (nothing on the mainnet build). */
export function TestnetTag() {
  return IS_TESTNET ? <span className="testnet-tag">Testnet</span> : null;
}

export function Sparkline({ values, w = 96, h = 28, label }: { values: number[]; w?: number; h?: number; label: string }) {
  const v = values.length > 1 ? values : [0, 0];
  const max = Math.max(1, ...v);
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * w},${h - 2 - (y / max) * (h - 4)}`).join(' ');
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <polyline points={`0,${h} ${pts} ${w},${h}`} className="spark-fill" />
      <polyline points={pts} className="spark-line" />
      <circle cx={w} cy={h - 2 - (v[v.length - 1] / max) * (h - 4)} r="2.5" className="spark-dot" />
    </svg>
  );
}

/** Stepper with live states. */
export function Stepper({ defs, state, compact }: { defs: StepDef[]; state: StepState; compact?: boolean }) {
  return (
    <ol className={`stepper ${compact ? 'stepper-compact' : ''}`} aria-label="Transfer steps">
      {defs.map((d, i) => {
        const s = state[d.id]?.state || 'idle';
        return (
          <li key={d.id} className={`step step-${s}`} aria-current={s === 'active' ? 'step' : undefined}>
            <span className="step-dot">
              {s === 'done' ? <Icon name="check" size={14} /> : s === 'error' ? <Icon name="x" size={14} /> : s === 'active' ? <Icon name="loader" size={14} className="spin" /> : i + 1}
            </span>
            <span className="step-txt">
              <b>{d.label}</b>
              <small>{state[d.id]?.message || d.hint}</small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Steps of a stored transfer derived from its status. */
export function recordSteps(t: TransferRecord): StepState {
  const done = { state: 'done' as const };
  const act = { state: 'active' as const };
  if (t.kind === 'fast')
    return {
      approve: done,
      send: { ...done, tx: t.originTx },
      relay: t.status === 'delivered' ? done : act,
      deliver: t.status === 'delivered' ? done : { state: 'idle' },
    };
  if (t.direction === 'deposit')
    return { send: done, relay: t.status === 'delivered' ? done : act, deliver: t.status === 'delivered' ? done : { state: 'idle' } };
  return {
    send: done,
    challenge: t.status === 'challenge' ? { state: 'active', message: 'Waiting for a confirmed rollup assertion' } : done,
    claim: t.status === 'claimed' ? done : t.status === 'claimable' ? { state: 'idle', message: 'Ready: sign the claim' } : { state: 'idle' },
  };
}

/** opens the shared Gully Chain "Connect a wallet" dialog (gc-connect); errors land in the wallet store */
export const pickWallet = () => {
  openConnect().catch(() => {
    /* shown from the store */
  });
};

export function WalletButton({ compact }: { compact?: boolean }) {
  const w = useWallet();
  useEffect(() => startDiscovery(), []);
  if (w.address)
    return (
      <button className="wallet-pill" onClick={() => disconnect()} title="Disconnect">
        <span className="wallet-dot" />
        {short(w.address)}
        {!compact && w.chainId && (
          <small className="wallet-chain">
            <ChainMark chain={w.chainId === 485590 ? 'gullychaintestnet' : 'arbitrumsepolia'} size={16} badge />
            {CHAINS[w.chainId === 485590 ? 'gullychaintestnet' : 'arbitrumsepolia']?.short}
          </small>
        )}
      </button>
    );
  return (
    <Btn variant="secondary" icon="wallet" arrow={false} onClick={pickWallet} className="btn-sm" disabled={w.connecting}>
      Connect
    </Btn>
  );
}

export function AmountField({ b, big }: { b: BridgeState; big?: boolean }) {
  const sym = b.quote?.sendSymbol || (b.direction === 'withdraw' && b.kind === 'fast' ? b.route.tokens.gullychaintestnet.symbol : 'ETH');
  return (
    <div className={`amount ${big ? 'amount-big' : ''} ${amountSize(b.amountText)}`}>
      <label htmlFor="amount">You send</label>
      <div className="amount-row">
        <input
          id="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.0"
          value={b.amountText}
          onChange={(e) => b.setAmountText(e.target.value.replace(',', '.'))}
          aria-describedby="amount-bal"
        />
        <span className="token-chip">
          <ChainMark chain={b.from} size={20} />
          {sym}
        </span>
      </div>
      <div className="amount-meta" id="amount-bal">
        {/* ETH/USD only: a Gully Core coin has no USD price here */}
        <UsdLine v={!b.mirror && b.amount && b.amount > 0n ? b.amount : null} />
        {b.wallet.address && b.balanceFrom !== undefined ? (
          <>
            <span>
              Balance {ethN(Number(fmtAmount(b.balanceFrom, 18, 18).replaceAll(',', '')))} {sym}
            </span>
            <button className="link-btn" onClick={() => b.setAmountText(fmtAmount(b.balanceFrom!, 18, 18).replaceAll(',', ''))}>
              Max
            </button>
          </>
        ) : (
          <span className="amount-on">
            on <ChainMark chain={b.from} size={16} /> {CHAINS[b.from].name}
          </span>
        )}
      </div>
    </div>
  );
}

export function RouteOptions({ b }: { b: BridgeState }) {
  const opts = (['fast', 'canonical'] as const).map((k) => {
    const q = b.quotes[k];
    const eta = q ? duration(q.etaSeconds) : k === 'fast' ? '~1 min' : b.direction === 'deposit' ? '~1 min' : '~45 min';
    return { k, q, eta };
  });
  return (
    <div className="routes" role="radiogroup" aria-label="Route">
      {opts.map(({ k, q, eta }) => {
        const selected = b.kind === k;
        const rec = b.pick.kind === k;
        const unavailable = q && !q.available;
        return (
          <button
            key={k}
            role="radio"
            aria-checked={selected}
            className={`route ${selected ? 'route-on' : ''} ${unavailable ? 'route-off' : ''}`}
            onClick={() => b.setKind(k === b.pick.kind ? undefined : k)}
          >
            <span className="route-ic">
              <Icon name={k === 'fast' ? 'zap' : 'shield'} />
            </span>
            <span className="route-main">
              <b>
                {k === 'fast' ? 'Fast' : 'Canonical'}
                {rec && <em className="badge-rec">Best</em>}
              </b>
              <small>
                {k === 'fast'
                  ? `Minutes both ways · receive ${q?.receiveSymbol || (b.direction === 'deposit' ? b.route.tokens.gullychaintestnet.symbol : 'ETH')}`
                  : b.direction === 'deposit'
                    ? 'Rollup bridge · native gas ETH'
                    : 'Rollup bridge · challenge period, then claim'}
              </small>
            </span>
            <span className="route-eta">
              <Icon name="clock" size={14} />
              {eta}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Gully Warp Mirrors: which asset the card moves. Shown only when /mirrors.json listed at least one mirror route
 * (the ETH routes stay the default; a deep link `?token=&to=` preselects a mirror).
 */
export function AssetPicker({ b }: { b: BridgeState }) {
  if (!b.mirrorRoutes.length) return null;
  return (
    <label className="asset-pick">
      <span>Asset</span>
      <select value={b.mirror ? b.route.id : ''} onChange={(e) => b.selectMirror(e.target.value || undefined)} aria-label="Asset to bridge">
        <option value="">ETH</option>
        {b.mirrorRoutes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.warp!.coinSymbol} ⇄ {r.tokens[r.warp!.chain].symbol} on {CHAINS[r.warp!.chain].short}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The label every mirror surface carries (owner wording), the provenance links and the Gully Core credit.
 * "Bridge back" = destination -> Gully Chain, where the coin trades on its Gully Core pool.
 */
export function WarpMirrorNotice({ b }: { b: BridgeState }) {
  const m = b.mirror;
  if (!m) return null;
  const mirrorSym = b.route.tokens[m.chain].symbol;
  return (
    <div className="note mirror-note" role="status">
      <Icon name="info" size={16} />
      <span>
        <b>{m.label}</b>
        <br />
        {b.direction === 'deposit'
          ? `Bridge back: ${mirrorSym} on ${CHAINS[m.chain].short} returns 1:1 as ${m.coinSymbol} on GullyChain. `
          : `${m.coinSymbol} is locked on GullyChain and ${mirrorSym} is minted 1:1 on ${CHAINS[m.chain].short}. `}
        <Ext href={m.provenanceUrl} newTab>
          Official mirror
        </Ext>
        {' · '}
        <Ext href={m.kre8Url} newTab>
          {m.coinSymbol} coin page
        </Ext>
        {' · '}
        <button className="link-btn" onClick={() => b.selectMirror(undefined)}>
          Bridge ETH instead
        </button>
      </span>
      <a className="gc-core-mark" href={GULLY_CORE_URL} target="_blank" rel="noopener noreferrer" aria-label="Powered by Gully Core (opens in a new tab)">
        <img
          src="brand/badges/gully-core-mark-dark.svg"
          srcSet="brand/badges/gully-core-mark-dark.png 1x, brand/badges/gully-core-mark-dark-2x.png 2x, brand/badges/gully-core-mark-dark-3x.png 3x"
          width={146}
          height={24}
          alt="Powered by Gully Core"
        />
      </a>
    </div>
  );
}

/**
 * Retired Fast routes (gETH, hypETH): never offered for deposits. A wallet that still holds one of their tokens gets a
 * one-click redeem (GullyChain -> Arbitrum Sepolia on that route), so nothing bridged earlier is ever stranded.
 */
export function LegacyNotice({ b }: { b: BridgeState }) {
  if (b.route.legacy)
    return (
      <div className="note legacy-note" role="status">
        <Icon name="info" size={16} />
        <span>
          Redeeming {b.route.tokens.gullychaintestnet.symbol} ({b.route.tokens.gullychaintestnet.name}, a retired route) for ETH on Arbitrum
          Sepolia.{' '}
          <button className="link-btn" onClick={b.useDefaultRoute}>
            Bridge ETH instead
          </button>
        </span>
      </div>
    );
  if (!b.legacyHoldings.length) return null;
  return (
    <div className="note legacy-note" role="status">
      <Icon name="info" size={16} />
      <span>
        {b.legacyHoldings.map((h) => (
          <span key={h.routeId}>
            You hold {ethN(Number(h.balance) / 1e18)} {h.symbol} from a retired Fast route.{' '}
            <button className="link-btn" onClick={() => b.redeemLegacy(h.routeId)}>
              Redeem for ETH
            </button>{' '}
          </span>
        ))}
      </span>
    </div>
  );
}

/**
 * Mirror routes (the GullyChain token is minted on Gully Chain, not native): one line + the official compact
 * "Powered by Gully Core" mark (brand kit v4 badges/gully-core-mark-dark.*, 146x24, byte-identical, never restyled).
 */
export function MirrorNotice({ b }: { b: BridgeState }) {
  if (!b.route?.mirror) return null;
  return (
    <div className="note mirror-note" role="status">
      <Icon name="info" size={16} />
      <span>This token is a Gully Core mirror on Gully Chain.</span>
      <a className="gc-core-mark" href={GULLY_CORE_URL} target="_blank" rel="noopener noreferrer" aria-label="Powered by Gully Core (opens in a new tab)">
        <img
          src="brand/badges/gully-core-mark-dark.svg"
          srcSet="brand/badges/gully-core-mark-dark.png 1x, brand/badges/gully-core-mark-dark-2x.png 2x, brand/badges/gully-core-mark-dark-3x.png 3x"
          width={146}
          height={24}
          alt="Powered by Gully Core"
        />
      </a>
    </div>
  );
}

export function QuoteDetails({ b }: { b: BridgeState }) {
  const q = b.quote;
  if (b.quoteError) return <p className="err" role="alert">{b.quoteError}</p>;
  if (!q) return <div className="quote quote-loading" aria-busy="true"><span className="shimmer" /><span className="shimmer" /></div>;
  const amt = b.amount && b.amount > 0n;
  return (
    <dl className="quote">
      <div>
        <dt>You receive</dt>
        <dd>
          {amt ? <Money v={q.receive} symbol={q.receiveSymbol} inline /> : '–'} <small>on {CHAINS[q.to].short}</small>
        </dd>
      </div>
      {q.fees.map((f) => (
        <div key={f.label}>
          <dt>{f.label}</dt>
          <dd>{f.amount === 0n ? 'Free' : <Money v={f.amount} symbol={f.symbol} inline />}</dd>
        </div>
      ))}
      <div>
        <dt>Time</dt>
        <dd>{duration(q.etaSeconds)}</dd>
      </div>
      {b.url.ref && (
        <div>
          <dt>Integrator</dt>
          <dd className="mono">{short(b.url.ref)}</dd>
        </div>
      )}
      {q.notes.map((n) => (
        <p key={n} className="note">
          <Icon name="info" size={14} />
          {n}
        </p>
      ))}
    </dl>
  );
}

export function ActionButton({ b }: { b: BridgeState }) {
  if (!b.wallet.address)
    return (
      <>
        <Btn icon="wallet" className="btn-block" onClick={pickWallet} disabled={b.wallet.connecting}>
          Connect wallet
        </Btn>
        {b.wallet.error && <p className="err">{b.wallet.error}</p>}
        <ConsentLine />
      </>
    );
  const wrongChain = b.wallet.chainId !== CHAINS[b.from].id;
  return (
    <>
      <Btn
        icon={b.kind === 'fast' ? 'zap' : 'shield'}
        className="btn-block"
        disabled={!!b.blocker || b.busy}
        busy={b.busy}
        onClick={b.send}
      >
        {b.busy ? 'Confirm in your wallet' : b.blocker || `${wrongChain ? `Switch to ${CHAINS[b.from].short} and ` : ''}${b.kind === 'fast' ? 'Bridge fast' : b.direction === 'deposit' ? 'Deposit' : 'Start withdrawal'}`}
      </Btn>
      <ConsentLine />
      <CapsNote />
    </>
  );
}

/** Phase 1 limits under the button (mainnet build only; the testnet bridge has none, so nothing renders). */
export function CapsNote() {
  const lines = capLines(CAPS);
  if (!lines.length) return null;
  return (
    <div className="caps-note" role="note" aria-label="Phase 1 limits" data-testid="caps-note">
      <b>Phase 1 limits</b>
      <ul>
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

export function ActivityList({ items, error, limit = 8, preview }: { items?: ActivityItem[]; error?: string; limit?: number; preview?: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  if (error && !items)
    return (
      <div className="empty">
        <Icon name="alert" size={24} />
        <p>Live transfers are unavailable: the chains did not answer. Retrying.</p>
      </div>
    );
  if (!items)
    return (
      <ul className="feed" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="feed-row">
            <span className="shimmer" />
          </li>
        ))}
      </ul>
    );
  if (!items.length)
    return (
      <div className="empty">
        <Icon name="activity" size={24} />
        <p>No transfers in the last two days yet. Be the first.</p>
      </div>
    );
  return (
    <ul className="feed">
      {items.slice(0, limit).map((i) => (
        <li key={i.key} className="feed-row feed-in">
          <span className={`feed-kind feed-${i.kind}`}>
            <Icon name={i.kind === 'fast' ? 'zap' : 'shield'} size={14} />
            {i.kind === 'fast' ? 'Fast' : 'Canonical'}
          </span>
          <span className="feed-dir">
            <ChainMark chain={i.direction === 'deposit' ? 'arbitrumsepolia' : 'gullychaintestnet'} size={16} />
            <Icon name="arrowRight" size={12} />
            <ChainMark chain={i.direction === 'deposit' ? 'gullychaintestnet' : 'arbitrumsepolia'} size={16} />
          </span>
          <span className="feed-amt">
            <Money v={i.amount} symbol={i.symbol} />
          </span>
          <span className="feed-time">{i.time ? ago(i.time) : ''}</span>
          {preview ? (
            <span className="feed-link" />
          ) : (
            <Ext href={txUrl(i.chain, i.tx)} className="feed-link" newTab>
              <Icon name="external" size={14} />
              <span className="sr">View transaction</span>
            </Ext>
          )}
        </li>
      ))}
    </ul>
  );
}

export function MyTransfers({ b }: { b: BridgeState }) {
  const list = b.transfers.filter((t) => !b.wallet.address || t.sender.toLowerCase() === b.wallet.address.toLowerCase() || t.recipient.toLowerCase() === b.wallet.address.toLowerCase());
  if (!list.length) return null;
  return (
    <section className="mine" aria-label="Your transfers">
      <h3 className="label">Your transfers</h3>
      <ul>
        {list.slice(0, 5).map((t) => (
          <li key={t.id} className={`mine-row mine-${t.status}`}>
            <div className="mine-top">
              <span className={`feed-kind feed-${t.kind}`}>
                <Icon name={t.kind === 'fast' ? 'zap' : 'shield'} size={14} />
                {t.kind === 'fast' ? 'Fast' : 'Canonical'}
              </span>
              <b>
                <Money v={BigInt(t.amount)} symbol={t.sendSymbol} inline />
              </b>
              <span className="mine-status">{statusLabel(t)}</span>
              <Ext href={txUrl(t.from, t.originTx)} className="feed-link" newTab>
                <Icon name="external" size={14} />
                <span className="sr">View origin transaction</span>
              </Ext>
            </div>
            <Stepper defs={stepDefsOf(t)} state={recordSteps(t)} compact />
            {/* Bridge & Earn: a Fast-lane delivery on Gully Chain (t.to === 'gullychaintestnet') is the "bridge arrival"
                the rewards attester matches; the notice carries the Hyperlane message id and shows only while live */}
            {t.status === 'delivered' && t.kind === 'fast' && t.to === CHILD && <BridgeEarnDelivered messageId={t.messageId} />}
            {t.status === 'claimable' && (
              <Btn icon="key" onClick={() => b.claim(t)} busy={b.busy} disabled={b.busy} className="btn-sm">
                Claim on {CHAINS[PARENT].name}
              </Btn>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function statusLabel(t: TransferRecord) {
  switch (t.status) {
    case 'relaying':
      return 'In flight';
    case 'delivered':
      return 'Delivered';
    case 'challenge':
      return `Challenge period · ${duration(t.etaSeconds)}`;
    case 'claimable':
      return 'Ready to claim';
    case 'claimed':
      return 'Claimed';
    case 'failed':
      return 'Failed';
    default:
      return 'Sent';
  }
}

function stepDefsOf(t: TransferRecord): StepDef[] {
  if (t.kind === 'fast')
    return [
      { id: 'send', label: 'Send', hint: CHAINS[t.from].short, chain: t.from, user: true },
      { id: 'relay', label: 'Relay', hint: 'Relayer delivering', chain: t.to, user: false },
      { id: 'deliver', label: 'Delivered', hint: CHAINS[t.to].short, chain: t.to, user: false },
    ];
  if (t.direction === 'deposit')
    return [
      { id: 'send', label: 'Send', hint: CHAINS[t.from].short, chain: t.from, user: true },
      { id: 'relay', label: 'Sequenced', hint: 'GullyChain reads it', chain: t.to, user: false },
      { id: 'deliver', label: 'Delivered', hint: CHAINS[t.to].short, chain: t.to, user: false },
    ];
  return [
    { id: 'send', label: 'Send', hint: CHAINS[t.from].short, chain: t.from, user: true },
    { id: 'challenge', label: 'Challenge', hint: duration(t.etaSeconds), chain: t.to, user: false },
    { id: 'claim', label: 'Claim', hint: CHAINS[t.to].short, chain: t.to, user: true },
  ];
}

/** Footer links: every one carries a Lucide icon next to its label (owner rule 2026-10-30, icons on the whole stack). */
export const FOOT_LINKS_ALL: { label: string; icon: IconName; href: string | null; newTab?: boolean }[] = [
  { label: 'GullyChain', icon: 'house', href: LINKS.chain },
  { label: 'Explorer', icon: 'search', href: LINKS.explorer },
  { label: 'Faucet', icon: 'droplet', href: LINKS.faucet },
  { label: 'Docs', icon: 'book', href: LINKS.docs },
  { label: 'Developers', icon: 'code', href: LINKS.dev },
  { label: 'Ecosystem', icon: 'grid', href: LINKS.chainEcosystem },
  { label: 'Status', icon: 'radio', href: LINKS.status },
  { label: 'Gully ecosystem →', icon: 'globe', href: LINKS.ecosystem, newTab: true },
  { label: 'Telegram', icon: 'send', href: LINKS.telegram },
  { label: 'Discord', icon: 'message', href: LINKS.discord },
  { label: 'X', icon: 'twitter', href: LINKS.x },
];
/** The faucet is testnet only, so the mainnet build drops it (LINKS.faucet is null there). */
export const FOOT_LINKS = FOOT_LINKS_ALL.filter((l): l is { label: string; icon: IconName; href: string; newTab?: boolean } => !!l.href);

/** Gully Chain's Terms and Privacy (gullychain.xyz), in every footer, the embed's minimal one too. Another origin: new tab. */
export const LEGAL_LINKS: { label: string; icon: IconName; href: string }[] = [
  { label: 'Terms', icon: 'book', href: LINKS.terms },
  { label: 'Privacy', icon: 'shield', href: LINKS.privacy },
];

/** One line under the transfer button: bridging means agreeing to the Gully Chain Terms and Privacy Policy. */
export function ConsentLine() {
  return (
    <p className="consent" data-testid="consent">
      By bridging you agree to the Gully Chain{' '}
      <Ext href={LINKS.terms} newTab>
        Terms
      </Ext>{' '}
      and{' '}
      <Ext href={LINKS.privacy} newTab>
        Privacy Policy
      </Ext>
      .
    </p>
  );
}

export function Footer({ minimal }: { minimal?: boolean }) {
  return (
    <footer className="foot">
      <div className="foot-in">
        {/* brand kit v4 icon (logo/gc-icon.svg, byte-identical); kit v4 has no wordmark file */}
        <a className="foot-brand" href={LINKS.chain} aria-label="Gully Chain home">
          <img src="brand/logo/gc-icon.svg" width={32} height={32} alt="Gully Chain" />
        </a>
        {!minimal && (
          <nav className="foot-links" aria-label="Footer">
            {FOOT_LINKS.map((l) => (
              <Ext key={l.label} href={l.href} newTab={l.newTab}>
                <Icon name={l.icon} />
                {l.label}
              </Ext>
            ))}
          </nav>
        )}
        <div className="foot-badges">
          <a className="gc-badge" href={LINKS.chain} aria-label="Powered by GullyChain">
            {/* brand kit v4 badges/badge-dark.png (960x256, byte-identical) shown at 180x48 */}
            <img src="brand/badges/badge-dark.png" width={180} height={48} alt="Powered by GullyChain" />
          </a>
          <Ext href={LINKS.gullyLabs} className="badge-link" newTab>
            <img src="brand/badges/gully-labs-powered-by-dark.svg" width={140} height={48} alt="Powered by Gully Labs" />
          </Ext>
          <p className="credit">
            Fast lane secured by <Ext href={LINKS.hyperlane}>Hyperlane</Ext>. Canonical lane: the GullyChain Arbitrum Nitro
            rollup bridge.{IS_TESTNET ? ' Testnet: no real value.' : ''}
          </p>
          <nav className="foot-legal" aria-label="Legal">
            {LEGAL_LINKS.map((l) => (
              <Ext key={l.href} href={l.href} newTab>
                <Icon name={l.icon} size={16} />
                {l.label}
              </Ext>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

/** Font step for the amount input: long numbers get smaller instead of overflowing the card. */
export function amountSize(text: string) {
  const n = text.length;
  return n > 16 ? 'amount-xs' : n > 12 ? 'amount-sm' : n > 9 ? 'amount-md' : '';
}
