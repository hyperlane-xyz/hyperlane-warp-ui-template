// Bridge & Earn side card (owner decision 2026-10-30, SPEC-bridge-and-earn): real indexer numbers labelled testnet, the
// four steps, the plain-words risks, and the way into kre8.fun DeFi. Shown on the bridge while the destination is
// Gully Chain. Degrades to one quiet line while the program (contract + indexer endpoints) is not live.
import { EARN_LINKS, EARN_NOT_LIVE, EARN_ONE_LINER, EARN_STEPS, EARN_TITLE, EARN_WARNINGS } from '../../earn/copy';
import { claimDeadlineText, count, daysLeftText, hourlyDeltas, perDay, usd } from '../../earn/format';
import { useLpRewardsStats, type LpRewardsSnapshot } from '../../earn/lpRewards';
import { Icon } from '../common/icons';
import { Ext, Sparkline, TestnetTag } from '../common/parts';

/** The card wired to the live store (one 30 s poll shared by every subscriber). */
export function BridgeEarn() {
  return <BridgeEarnCard state={useLpRewardsStats()} />;
}

export function BridgeEarnCard({ state }: { state: LpRewardsSnapshot }) {
  const { loading, live, stats, series } = state;
  const isLive = live && !!stats;
  return (
    <section className="card earn-card" data-testid="bridge-earn-card" data-live={isLive ? 'true' : 'false'} aria-label={EARN_TITLE}>
      <div className="card-head">
        <h2 className="label">
          <Icon name="sparkles" size={14} /> {EARN_TITLE}
        </h2>
        <TestnetTag />
      </div>
      <p className="earn-lede">{EARN_ONE_LINER}</p>

      {loading ? (
        <div className="chart-loading" aria-busy="true" data-testid="bridge-earn-loading">
          <span className="shimmer" />
          <span className="shimmer" />
        </div>
      ) : !isLive ? (
        <p className="earn-not-live" data-testid="bridge-earn-not-live">
          <Icon name="info" size={16} />
          <span>
            {EARN_NOT_LIVE}{' '}
            <Ext href={EARN_LINKS.docs} testId="bridge-earn-docs-link">
              How it works
            </Ext>
          </span>
        </p>
      ) : (
        <>
          <div className="earn-stats" data-testid="bridge-earn-stats">
            <Stat label="Paid out so far" value={usd(stats.distributedUsd)} testId="bridge-earn-paid" />
            <Stat label="Participants" value={count(stats.participants)} testId="bridge-earn-participants" />
            <Stat label="Days left" value={daysLeftText(stats.daysLeft)} testId="bridge-earn-days" />
          </div>
          <EarnSpark series={series} ratePerDayUsd={stats.ratePerDayUsd} />
          <ol className="stepper earn-steps" aria-label="How Bridge & Earn works">
            {EARN_STEPS.map((s, i) => (
              <li key={s.label} className="step step-idle">
                <span className="step-dot">{i + 1}</span>
                <span className="step-txt">
                  <b>
                    <Icon name={s.icon} size={12} /> {s.label}
                  </b>
                  <small>{i === EARN_STEPS.length - 1 ? `any time ${claimDeadlineText(stats.claimDeadline)}` : s.hint}</small>
                </span>
              </li>
            ))}
          </ol>
          <details className="earn-risks" data-testid="bridge-earn-risks">
            <summary>
              <Icon name="alert" size={14} /> Risks <small>impermanent loss, range, exit rules</small>
              <Icon name="chevron" size={16} className="earn-chev" />
            </summary>
            <ul>
              {EARN_WARNINGS.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </details>
          <div className="earn-actions">
            {/* kre8.fun is outside the gullychain.xyz family: always a new tab, the bridge stays on screen */}
            <a href={EARN_LINKS.app} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" data-testid="bridge-earn-app-link">
              <Icon name="sparkles" />
              <span>Open kre8.fun DeFi</span>
              <Icon name="arrowRight" className="btn-arrow" />
            </a>
            <Ext href={EARN_LINKS.docs} className="earn-docs" testId="bridge-earn-docs-link">
              <Icon name="book" size={16} /> How it works
            </Ext>
          </div>
        </>
      )}
    </section>
  );
}

/** One measured number; the value remounts on change so the pop animation replays. */
function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="earn-stat" data-testid={testId}>
      <small>{label}</small>
      <b className="earn-num" key={value}>
        {value}
      </b>
    </div>
  );
}

/** Fees paid out per hour (deltas of the cumulative series), plus the rate right now. Nothing drawn without 2+ points. */
function EarnSpark({ series, ratePerDayUsd }: { series: LpRewardsSnapshot['series']; ratePerDayUsd: number }) {
  const hourly = series && series.length > 2 ? hourlyDeltas(series.map((p) => p.distributedUsd)).slice(-48) : null;
  return (
    <div className="earn-rate-wrap">
      {hourly && (
        <div className="earn-spark" data-testid="bridge-earn-spark">
          <Sparkline values={hourly} w={240} h={36} label="Fees paid out per hour, last 48 hours, USD" />
        </div>
      )}
      <small className="muted earn-rate">
        <span>{perDay(ratePerDayUsd)} right now</span>
        <span>measured on testnet, not projected</span>
      </small>
    </div>
  );
}
