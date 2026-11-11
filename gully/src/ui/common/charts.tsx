// Live charts (inline SVG). Gully Chain Night chart palette (shared tokens, src/styles/night/tokens.css): Fast = --gn-c1
// (cyan, 8.2:1 on night) / Canonical = --gn-c3 (lifted blue, 5.6:1); series are also named in legends and tooltips,
// never colour alone. Colours are CSS variables, so they are set through style (fill/stroke), not SVG attributes.
// Every chart has a hover tooltip, a legend or title naming its series, and a visually hidden table.
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { duration } from '../../bridge/format';
import { Money } from './money';

export const SERIES = { fast: 'var(--gn-c1)', canonical: 'var(--gn-c3)' } as const;

/** adds .in once the element scrolls into view (charts animate in on scroll) */
export function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') return setInView(true);
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setInView(true), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);
  return [ref, inView] as const;
}

export function ChartCard({ title, sub, children, legend, className = '' }: { title: string; sub?: ReactNode; children: ReactNode; legend?: ReactNode; className?: string }) {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <section ref={ref} className={`card chart-card ${inView ? 'in' : ''} ${className}`} aria-label={title}>
      <div className="chart-head">
        <h3 className="label">{title}</h3>
        {sub && <small className="muted">{sub}</small>}
      </div>
      {legend}
      {children}
    </section>
  );
}

export function Legend({ items }: { items: { label: string; color: string; hatch?: boolean }[] }) {
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.label}>
          <i style={{ background: i.color }} className={i.hatch ? 'hatch' : ''} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function Tip({ x, y, children, w }: { x: number; y: number; children: ReactNode; w: number }) {
  const left = Math.min(Math.max(x, 70), w - 70);
  return (
    <div className="tip" style={{ left: `${(left / w) * 100}%`, top: y }}>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="chart-empty">{children}</div>;
}

/** stacked bars per hour: Fast vs Canonical volume */
export function StackedBars({ data }: { data: { t: number; fast: number; canonical: number; count: number }[] }) {
  const [hover, setHover] = useState<number>();
  const W = 600;
  const H = 150;
  const max = Math.max(1e-9, ...data.map((d) => d.fast + d.canonical));
  const bw = W / data.length;
  const y = (v: number) => (v > 0 ? Math.max(2, (v / max) * (H - 18)) : 0); // nonzero hours stay visible
  const total = data.reduce((a, d) => a + d.fast + d.canonical, 0);
  if (!total) return <Empty>No ETH bridged in the last 48 hours yet. The chart fills in as transfers land.</Empty>;
  return (
    <div className="chart" onMouseLeave={() => setHover(undefined)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="bars" role="img" aria-label="ETH bridged per hour, Fast and Canonical">
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="axis" />
        {data.map((d, i) => {
          const hf = y(d.fast);
          const hc = y(d.canonical);
          return (
            <g key={d.t} onMouseEnter={() => setHover(i)}>
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              {hc > 0 && <rect className="bar" x={i * bw + 1} y={H - hc} width={Math.max(1, bw - 2)} height={hc} rx="2" style={{ fill: SERIES.canonical, transitionDelay: `${i * 8}ms` }} />}
              {hf > 0 && <rect className="bar" x={i * bw + 1} y={H - hc - hf - (hc > 0 ? 2 : 0)} width={Math.max(1, bw - 2)} height={hf} rx="2" style={{ fill: SERIES.fast, transitionDelay: `${i * 8}ms` }} />}
            </g>
          );
        })}
      </svg>
      <div className="xaxis">
        <span>48h ago</span>
        <span>24h</span>
        <span>now</span>
      </div>
      {hover !== undefined && (
        <Tip x={hover * bw + bw / 2} y={4} w={W}>
          <b>{new Date(data[hover].t).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</b>
          <span>Fast <Money v={data[hover].fast} inline /></span>
          <span>Canonical <Money v={data[hover].canonical} inline /></span>
          <span>{data[hover].count} transfers</span>
        </Tip>
      )}
      <table className="sr">
        <caption>ETH bridged per hour</caption>
        <thead>
          <tr><th>Hour</th><th>Fast ETH</th><th>Canonical ETH</th><th>Transfers</th></tr>
        </thead>
        <tbody>
          {data.filter((d) => d.count).map((d) => (
            <tr key={d.t}><td>{new Date(d.t).toISOString()}</td><td>{d.fast}</td><td>{d.canonical}</td><td>{d.count}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** delivery time per lane: dots + line over time (seconds, one axis) */
export function DeliveryChart({ points }: { points: { kind: 'fast' | 'canonical'; t: number; s: number }[] }) {
  const [hover, setHover] = useState<number>();
  const W = 600;
  const H = 150;
  if (!points.length) return <Empty>No delivered transfers in the window yet. Delivery times show here as soon as one lands.</Empty>;
  const t0 = Math.min(...points.map((p) => p.t));
  const t1 = Math.max(...points.map((p) => p.t), t0 + 1);
  const max = Math.max(30, ...points.map((p) => p.s));
  const x = (t: number) => 12 + ((t - t0) / (t1 - t0)) * (W - 24);
  const y = (s: number) => H - 10 - (s / max) * (H - 26);
  const line = (k: 'fast' | 'canonical') =>
    points.filter((p) => p.kind === k).sort((a, b) => a.t - b.t).map((p) => `${x(p.t)},${y(p.s)}`).join(' ');
  return (
    <div className="chart" onMouseLeave={() => setHover(undefined)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="lines" role="img" aria-label="Delivery time per lane, seconds">
        {[0.5, 1].map((f) => (
          <g key={f}>
            <line x1="0" x2={W} y1={y(max * f)} y2={y(max * f)} className="grid" />
            <text x="2" y={y(max * f) - 3} className="tick">{duration(max * f)}</text>
          </g>
        ))}
        {(['canonical', 'fast'] as const).map((k) => (
          <polyline key={k} points={line(k)} className="series-line" style={{ stroke: SERIES[k] }} />
        ))}
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <circle cx={x(p.t)} cy={y(p.s)} r="12" fill="transparent" />
            <circle cx={x(p.t)} cy={y(p.s)} r="4.5" style={{ fill: SERIES[p.kind] }} className="pt" />
          </g>
        ))}
      </svg>
      {hover !== undefined && (
        <Tip x={x(points[hover].t)} y={4} w={W}>
          <b>{points[hover].kind === 'fast' ? 'Fast' : 'Canonical'}</b>
          <span>{duration(points[hover].s)} to deliver</span>
          <span>{new Date(points[hover].t).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </Tip>
      )}
      <table className="sr">
        <caption>Delivery time per transfer</caption>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}><td>{p.kind}</td><td>{new Date(p.t).toISOString()}</td><td>{Math.round(p.s)} s</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** semicircle gauge: locked / supply */
export function BackingGauge({ supply, locked, symbol }: { supply: number; locked: number; symbol: string }) {
  const ratio = supply > 0 ? locked / supply : locked > 0 ? Infinity : 1;
  const pct = Math.min(1, isFinite(ratio) ? ratio : 1);
  const full = ratio >= 0.9999;
  const r = 70;
  const len = Math.PI * r;
  return (
    <div className="gauge">
      <svg viewBox="0 0 180 104" role="img" aria-label={`${symbol} backing ${supply > 0 ? Math.round(ratio * 100) : 100}%`}>
        <path d={`M20 92 A${r} ${r} 0 0 1 160 92`} className="gauge-bg" />
        <path d={`M20 92 A${r} ${r} 0 0 1 160 92`} className="gauge-fg" style={{ strokeDasharray: `${len * pct} ${len}` }} stroke="url(#gauge-grad)" />
        <defs>
          <linearGradient id="gauge-grad" x1="0" x2="1">
            <stop offset="0" style={{ stopColor: 'var(--gn-cyan)' }} />
            <stop offset="1" style={{ stopColor: 'var(--gn-green)' }} />
          </linearGradient>
        </defs>
        <text x="90" y="80" textAnchor="middle" className="gauge-num">
          {supply > 0 ? `${Math.min(999, Math.round(ratio * 100))}%` : '–'}
        </text>
      </svg>
      <p className={`gauge-state ${full ? 'ok' : 'warn'}`}>
        {supply === 0 && locked === 0 ? 'No ' + symbol + ' outstanding' : full ? 'Fully backed' : 'Under-backed: transfers in flight'}
      </p>
    </div>
  );
}

/** two series, same unit (ETH), one axis: supply and locked over time */
export function BackingLines({ series, symbol }: { series: { t: number; supply: number; locked: number }[]; symbol: string }) {
  const W = 600;
  const H = 110;
  if (series.length < 2) return <Empty>No {symbol} history yet.</Empty>;
  const t0 = series[0].t;
  const t1 = Math.max(series[series.length - 1].t, t0 + 1);
  const max = Math.max(1e-9, ...series.map((p) => Math.max(p.supply, p.locked)));
  const x = (t: number) => 6 + ((t - t0) / (t1 - t0)) * (W - 12);
  const y = (v: number) => H - 6 - (v / max) * (H - 16);
  const step = (k: 'supply' | 'locked') => series.map((p, i) => `${i ? `L${x(p.t)},${y(series[i - 1][k])} ` : 'M'}${x(p.t)},${y(p[k])}`).join(' ');
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="lines" role="img" aria-label={`${symbol} supply and ETH locked over time`}>
        <path d={step('locked')} className="series-line" style={{ stroke: SERIES.canonical }} />
        <path d={step('supply')} className="series-line dashed" style={{ stroke: SERIES.fast }} />
      </svg>
      <table className="sr">
        <caption>{symbol} supply and locked ETH</caption>
        <tbody>
          {series.map((p, i) => (
            <tr key={i}><td>{new Date(p.t).toISOString()}</td><td>{p.supply}</td><td>{p.locked}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** donut: route split (lane x direction), counts */
export function Donut({ parts }: { parts: { label: string; value: number; color: string; hatch?: boolean }[] }) {
  const [hover, setHover] = useState<number>();
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return <Empty>No transfers in the window yet.</Empty>;
  const r = 52;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="Transfers by route">
        {parts.map((p, i) => {
          if (!p.value) return null;
          const len = (p.value / total) * C;
          const el = (
            <circle
              key={p.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              strokeWidth={hover === i ? 22 : 18}
              strokeDasharray={`${Math.max(0, len - 2)} ${C}`}
              strokeDashoffset={-acc}
              className="donut-seg"
              style={{ stroke: p.color, strokeOpacity: p.hatch ? 0.55 : 1 }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(undefined)}
            />
          );
          acc += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" className="donut-num">{hover !== undefined ? parts[hover].value : total}</text>
        <text x="70" y="86" textAnchor="middle" className="donut-lab">{hover !== undefined ? parts[hover].label : 'transfers'}</text>
      </svg>
      <ul className="legend legend-col">
        {parts.map((p) => (
          <li key={p.label}>
            <i style={{ background: p.color, opacity: p.hatch ? 0.55 : 1 }} />
            {p.label} <b>{p.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
