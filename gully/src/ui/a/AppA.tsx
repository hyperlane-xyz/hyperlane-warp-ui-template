// Direction A: GullyChain "Terminal" (black ground, chart-led header, stat tiles, ticker, night cards).
import { CHAINS } from '../../config/chains';
import { fmtAmount } from '../../bridge/format';
import { Icon } from '../common/icons';
import { ActionButton, ActivityList, AmountField, AssetPicker, Footer, MyTransfers, QuoteDetails, RouteOptions, Sparkline, Stepper, WarpMirrorNotice } from '../common/parts';
import { ChainPair, CountUp, DirectionTabs, Header, AddUsdcRow } from '../common/shell';
import { useActivity, useBridge, useHeads, type UrlOptions } from '../useBridge';

export function AppA({ url }: { url: UrlOptions }) {
  const b = useBridge(url);
  const heads = useHeads();
  const act = useActivity();
  const fast = act.items?.filter((i) => i.kind === 'fast').length;
  const canon = act.items?.filter((i) => i.kind === 'canonical').length;

  const card = (
    <section className="card bridge-card" id="bridge" aria-label="Bridge">
      <div className="card-head">
        <h1 className="h-card">Gully Bridge</h1>
        {b.url.ref && <span className="ref-pill">via integrator</span>}
      </div>
      <DirectionTabs b={b} />
      <AssetPicker b={b} />
      <ChainPair b={b} />
      <AmountField b={b} />
      <WarpMirrorNotice b={b} />
      <h2 className="label">Route</h2>
      <RouteOptions b={b} />
      <QuoteDetails b={b} />
      {b.stepDefs.length > 0 && <Stepper defs={b.stepDefs} state={b.steps} />}
      <ActionButton b={b} />
      <AddUsdcRow />
    </section>
  );

  if (url.embed)
    return (
      <div className="embed a">
        {card}
        <Footer minimal />
      </div>
    );

  return (
    <div className="a">
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
            <div className="tile">
              <span className="label">
                <Icon name="zap" size={14} /> Fast transfers · 48h
              </span>
              <b className="tile-num">
                <CountUp value={fast} />
              </b>
              <small className="muted">~1 min, both ways</small>
            </div>
            <div className="tile">
              <span className="label">
                <Icon name="shield" size={14} /> Canonical · 48h
              </span>
              <b className="tile-num">
                <CountUp value={canon} />
              </b>
              <small className="muted">rollup bridge</small>
            </div>
          </section>
          <div className="tape" aria-hidden="true">
            <div className="tape-in">
              {[...(act.items || []), ...(act.items || [])].slice(0, 40).map((i, n) => (
                <span key={`${i.key}-${n}`}>
                  <i className={`dot dot-${i.kind}`} />
                  {i.kind === 'fast' ? 'FAST' : 'CANON'} {i.direction === 'deposit' ? 'ARB→GULLY' : 'GULLY→ARB'} {fmtAmount(i.amount, 18, 4)} {i.symbol}
                </span>
              ))}
              {!act.items?.length && <span>Waiting for live transfers…</span>}
            </div>
          </div>
          <div className="grid-a">
            {card}
            <div className="side">
              <MyTransfers b={b} />
              <section className="card" id="activity" aria-label="Recent transfers">
                <div className="card-head">
                  <h2 className="label">
                    <span className="live-dot" /> Recent transfers
                  </h2>
                  <small className="muted">from both chains, live</small>
                </div>
                <ActivityList items={act.items} error={act.error} limit={8} preview={url.preview} />
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
