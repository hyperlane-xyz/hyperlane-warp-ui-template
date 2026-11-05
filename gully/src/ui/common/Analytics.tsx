import { useEffect, useMemo, useState } from 'react';

import { getBridgeClient } from '../../bridge/bridgeClient';
import { ago, duration } from '../../bridge/format';
import { hourly, WINDOW_HOURS, type BridgeStats } from '../../bridge/stats';
import { BackingGauge, BackingLines, ChartCard, DeliveryChart, Donut, Empty, Legend, SERIES, StackedBars } from './charts';
import { Icon } from './icons';
import { Sparkline } from './parts';
import { Money, UsdNote } from './money';
import { asEth, ethN, fmtUsd, toUsd, useEthUsd } from '../../bridge/usd';
import { CHAINS } from '../../config/chains';

export function useStats(intervalMs = 30000) {
  const [stats, setStats] = useState<BridgeStats>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let stop = false;
    let busy = false;
    const tick = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const s = await getBridgeClient().stats();
        if (!stop) {
          setStats(s);
          setError(undefined);
        }
      } catch (e) {
        if (!stop) setError((e as Error).message || 'offline');
      } finally {
        busy = false;
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [intervalMs]);
  return { stats, error };
}

export function TransfersPerHourTile({ stats }: { stats?: BridgeStats }) {
  const h = useMemo(() => (stats ? hourly(stats.transfers, stats.at) : undefined), [stats]);
  return (
    <div className="tile">
      <span className="label">
        <Icon name="activity" size={14} /> Transfers · {WINDOW_HOURS}h
      </span>
      <b className="tile-num">{h ? h.reduce((a, b) => a + b.count, 0) : '–'}</b>
      {h && <Sparkline values={h.map((b) => b.count)} label="Transfers per hour, last 48 hours" />}
      <small className="muted">per hour, both lanes</small>
    </div>
  );
}

export function Analytics() {
  const price = useEthUsd();
  const totalLabel = (wei: bigint) => {
    const e = asEth(wei);
    const usd = toUsd(e, price);
    return usd === null ? `${ethN(e)} ETH total` : `${fmtUsd(usd)} total · ${ethN(e)} ETH`;
  };
  const { stats, error } = useStats();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const buckets = useMemo(() => (stats ? hourly(stats.transfers, stats.at) : []), [stats]);

  if (!stats)
    return (
      <section className="analytics" id="stats" aria-label="Bridge analytics">
        <h2 className="label section-label">
          <Icon name="activity" size={14} /> Bridge analytics
        </h2>
        <div className="card chart-card">
          {error ? (
            <Empty>Analytics are offline: the chains did not answer ({error.slice(0, 80)}). Retrying every 30 s.</Empty>
          ) : (
            <div className="chart-loading" aria-busy="true">
              <span className="shimmer" />
              <span className="shimmer" />
            </div>
          )}
        </div>
      </section>
    );

  const t = stats.transfers;
  const count = (k: string, d: string) => t.filter((x) => x.kind === k && x.direction === d).length;
  const delivery = t.filter((x) => x.kind === 'fast' && x.deliverySec !== undefined).map((x) => ({ kind: x.kind, t: x.time, s: x.deliverySec! }));
  const avg = (k: 'fast' | 'canonical') => {
    const v = delivery.filter((d) => d.kind === k);
    return v.length ? v.reduce((a, d) => a + d.s, 0) / v.length : undefined;
  };
  // the default native route shows its liquidity; a retired synthetic route (gETH) shows its backing while anyone holds it
  const liq = stats.backing.find((x) => x.kind === 'native' && !x.legacy);
  const b = stats.backing.find((x) => x.kind === 'synthetic' && x.supply > 0n) || (liq ? undefined : stats.backing[0]);
  const lastAge = stats.lastDeliveryAt ? (Date.now() - stats.lastDeliveryAt) / 1000 : undefined;
  const stuck = stats.pendingFast > 0 && stats.oldestPendingFastAt && Date.now() - stats.oldestPendingFastAt > 10 * 60_000;
  const relayer = stuck ? { cls: 'warn', icon: 'alert' as const, label: 'Delayed' } : { cls: 'ok', icon: 'check' as const, label: 'Healthy' };

  return (
    <section className="analytics" id="stats" aria-label="Bridge analytics">
      <h2 className="label section-label">
        <Icon name="activity" size={14} /> Bridge analytics <small className="muted">live from both chains · {WINDOW_HOURS}h</small>
      </h2>
      <UsdNote />
      <div className="an-grid">
        <ChartCard
          title={price ? 'Value bridged per hour' : 'ETH bridged per hour'}
          sub={totalLabel(t.reduce((a, x) => a + x.amount, 0n))}
          className="an-wide"
          legend={<Legend items={[{ label: 'Fast', color: SERIES.fast }, { label: 'Canonical', color: SERIES.canonical }]} />}
        >
          <StackedBars data={buckets} />
        </ChartCard>
        <ChartCard title="Route split" sub="transfers by lane and direction">
          <Donut
            parts={[
              { label: 'Fast → GullyChain', value: count('fast', 'deposit'), color: SERIES.fast },
              { label: 'Fast → Arbitrum', value: count('fast', 'withdraw'), color: SERIES.fast, hatch: true },
              { label: 'Canonical → GullyChain', value: count('canonical', 'deposit'), color: SERIES.canonical },
              { label: 'Canonical → Arbitrum', value: count('canonical', 'withdraw'), color: SERIES.canonical, hatch: true },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="Fast delivery time"
          sub={`dispatch to delivery · avg ${avg('fast') !== undefined ? duration(avg('fast')!) : '–'}`}
          className="an-wide"
        >
          <DeliveryChart points={delivery} />
          <p className="fine">Canonical deposits are credited in the GullyChain block that reads them; that block carries the deposit's own timestamp, so their delivery time is not measurable on chain and is not plotted.</p>
        </ChartCard>
        {liq && (
          <ChartCard title="Fast lane liquidity" sub="native ETH each router can pay out">
            <dl className="kv">
              <div><dt>GullyChain router (pays deposits)</dt><dd><Money v={liq.supply} inline /></dd></div>
              <div><dt>{CHAINS.arbitrumsepolia.name} router (pays withdrawals)</dt><dd><Money v={liq.locked} inline /></dd></div>
            </dl>
            <Legend items={[{ label: `${CHAINS.arbitrumsepolia.name} router`, color: SERIES.canonical }, { label: 'GullyChain router (dashed)', color: SERIES.fast }]} />
            <BackingLines series={liq.series} symbol="ETH liquidity" />
          </ChartCard>
        )}
        {(b || !liq) && (
        <ChartCard title={`${b?.symbol || 'gETH'} backing${b?.legacy ? ' (retired route)' : ''}`} sub={`ETH locked on ${CHAINS.arbitrumsepolia.name} vs supply on ${CHAINS.gullychaintestnet.short}`}>
          {b ? (
            <>
              <BackingGauge supply={Number(b.supply) / 1e18} locked={Number(b.locked) / 1e18} symbol={b.symbol} />
              <dl className="kv">
                <div><dt>{b.symbol} supply</dt><dd><Money v={b.supply} symbol={b.symbol} inline /></dd></div>
                <div><dt>ETH locked</dt><dd><Money v={b.locked} inline /></dd></div>
              </dl>
              <Legend items={[{ label: 'Locked ETH', color: SERIES.canonical }, { label: `${b.symbol} supply (dashed)`, color: SERIES.fast }]} />
              <BackingLines series={b.series} symbol={b.symbol} />
            </>
          ) : (
            <Empty>No Fast route configured.</Empty>
          )}
        </ChartCard>
        )}
        <ChartCard title="Relayer health" sub="Fast lane deliveries">
          <div className={`health ${relayer.cls}`}>
            <Icon name={relayer.icon} size={20} />
            <b>{relayer.label}</b>
          </div>
          <dl className="kv">
            <div><dt>Last delivery</dt><dd>{lastAge !== undefined ? ago(stats.lastDeliveryAt!) : 'none yet'}</dd></div>
            <div><dt>In flight</dt><dd>{stats.pendingFast}{stats.oldestPendingFastAt ? ` · oldest ${ago(stats.oldestPendingFastAt)}` : ''}</dd></div>
          </dl>
        </ChartCard>
        <ChartCard title="Canonical withdrawals" sub="challenge window, then claim">
          {stats.withdrawals.length ? (
            <ul className="wd-list">
              {stats.withdrawals.slice(0, 5).map((w) => {
                const total = w.readyAt - w.createdAt;
                const left = Math.max(0, w.readyAt - Date.now());
                return (
                  <li key={w.position.toString()}>
                    <span><Money v={w.amount} inline /></span>
                    <small>
                      {w.claimable
                        ? 'Ready to claim'
                        : left > 0
                          ? `${duration(left / 1000)} left`
                          : stats.assertionConfirmed
                            ? 'Waiting for the next confirmed assertion'
                            : 'Waiting for the first confirmed rollup assertion'}
                    </small>
                    <i className="wd-bar"><i style={{ width: `${Math.min(100, ((total - left) / total) * 100)}%` }} /></i>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>No canonical withdrawals pending.</Empty>
          )}
        </ChartCard>
      </div>
    </section>
  );
}
