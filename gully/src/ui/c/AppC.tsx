// Direction C (owner's pick, 2026-10-26): A's Terminal frame (stat tiles, ticker tape, live status column)
// around B's swap card and animated route visual.
import { CHAINS, CHILD } from '../../config/chains';
import { asEth, ethN, fmtUsd, toUsd, useEthUsd } from '../../bridge/usd';
import { FeedCards, RouteVisual, SwapCard } from '../b/AppB';
import { BridgeEarn } from '../earn/BridgeEarnCard';
import { Icon } from '../common/icons';
import { Analytics, TransfersPerHourTile, useStats } from '../common/Analytics';
import { ActivityList, Footer, MyTransfers, Sparkline } from '../common/parts';
import { CountUp, Header } from '../common/shell';
import { useActivity, useBridge, useHeads, type UrlOptions } from '../useBridge';

export function AppC({ url }: { url: UrlOptions }) {
  const b = useBridge(url);
  const heads = useHeads();
  const act = useActivity();
  const { stats } = useStats();
  const price = useEthUsd();
  const tapeAmt = (v: bigint, sym: string) => {
    const usd = toUsd(asEth(v), price);
    return usd === null ? `${ethN(asEth(v))} ${sym}` : `${fmtUsd(usd)} · ${ethN(asEth(v))} ${sym}`;
  };
  const fast = act.items?.filter((i) => i.kind === 'fast').length;
  const canon = act.items?.filter((i) => i.kind === 'canonical').length;

  if (url.embed)
    return (
      <div className="embed c">
        <SwapCard b={b} title="Gully Bridge" />
        <Footer minimal />
      </div>
    );

  return (
    <div className="a c">
      <a className="skip" href="#bridge">
        Skip to the bridge
      </a>
      <Header />
      <main>
        <div className="wrap">
          <section className="strip" aria-label="Live network">
            {(['arbitrumsepolia', 'gullychaintestnet'] as const).map((c) => (
              <div className="tile" key={c}>
                <span className="label">{CHAINS[c].short} block</span>
                <b className="tile-num">
                  <CountUp value={heads[c].block !== undefined ? Number(heads[c].block) : undefined} />
                </b>
                <Sparkline values={heads[c].history} label={`New ${CHAINS[c].short} blocks per poll`} />
                {!heads[c].ok && <small className="err">RPC not answering</small>}
              </div>
            ))}
            <TransfersPerHourTile stats={stats} />
            <div className="tile">
              <span className="label">
                <Icon name="layers" size={14} /> Lanes · recent
              </span>
              <b className="tile-num tile-split">
                <span><Icon name="zap" size={16} /> <CountUp value={fast} /></span>
                <span><Icon name="shield" size={16} /> <CountUp value={canon} /></span>
              </b>
              <small className="muted">Fast · Canonical transfers</small>
            </div>
          </section>
          <div className="tape" aria-hidden="true">
            <div className="tape-in">
              {[...(act.items || []), ...(act.items || [])].slice(0, 40).map((i, n) => (
                <span key={`${i.key}-${n}`}>
                  <i className={`dot dot-${i.kind}`} />
                  {i.kind === 'fast' ? 'FAST' : 'CANON'} {i.direction === 'deposit' ? 'ARB→GULLY' : 'GULLY→ARB'}{' '}
                  {tapeAmt(i.amount, i.symbol)}
                </span>
              ))}
              {!act.items?.length && <span>Waiting for live transfers…</span>}
            </div>
          </div>
          <div className="grid-c">
            <div className="hero-c">
              <div className="rv-wrap" aria-hidden={false}>
                <RouteVisual b={b} items={act.items} heads={heads} />
              </div>
              <SwapCard b={b} title="Gully Bridge" />
            </div>
            <div className="side">
              {/* Bridge & Earn: only while the form bridges INTO Gully Chain (b.to === 'gullychaintestnet') */}
              {b.to === CHILD && <BridgeEarn />}
              <section className="card status-card" aria-label="Network status">
                <div className="card-head">
                  <h2 className="label">
                    <span className="live-dot" /> Network status
                  </h2>
                </div>
                <ul className="status-list">
                  <li>
                    <Icon name="zap" size={16} />
                    <span>Fast lane</span>
                    <b className={b.quotes.fast?.available === false ? 'warn' : 'ok'}>
                      {b.quotes.fast ? (b.quotes.fast.available ? 'Live · ~1 min' : 'Low liquidity') : 'Checking…'}
                    </b>
                  </li>
                  <li>
                    <Icon name="shield" size={16} />
                    <span>Canonical deposits</span>
                    <b className="ok">Live · ~1 min</b>
                  </li>
                  <li>
                    <Icon name="clock" size={16} />
                    <span>Canonical withdrawals</span>
                    <b className="muted-b">Challenge period, then claim</b>
                  </li>
                  {(['arbitrumsepolia', 'gullychaintestnet'] as const).map((c) => (
                    <li key={c}>
                      <Icon name="radio" size={16} />
                      <span>{CHAINS[c].short} RPC</span>
                      <b className={heads[c].ok ? 'ok' : 'warn'}>{heads[c].ok ? 'Online' : 'Not answering'}</b>
                    </li>
                  ))}
                </ul>
              </section>
              <MyTransfers b={b} />
              <section className="card" id="activity" aria-label="Recent transfers">
                <div className="card-head">
                  <h2 className="label">
                    <span className="live-dot" /> Live transfers
                  </h2>
                  <small className="muted">from both chains</small>
                </div>
                <FeedCards items={act.items} />
                <ActivityList items={act.items} error={act.error} limit={7} preview={url.preview} />
              </section>
            </div>
          </div>
          <Analytics />
        </div>
      </main>
      <Footer />
    </div>
  );
}
