// Static-markup render of the Bridge & Earn card and the delivered notice (like tests/nav-icons.test.ts): live numbers,
// the not-live fallback, the warnings, the links (kre8.fun always in a new tab) and the deep link with the message id.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EARN_LINKS, EARN_WARNINGS } from '../../earn/copy';
import { INITIAL_SNAPSHOT, type LpRewardsSnapshot, type LpStats } from '../../earn/lpRewards';
import { BridgeEarnCard } from './BridgeEarnCard';
import { BridgeEarnDeliveredNotice, EARN_DELIVERED_TEXT } from './BridgeEarnDeliveredNotice';

const STATS: LpStats = {
  live: true,
  totalWeightUsd: 12345.5,
  participants: 42,
  activePositions: 57,
  distributedUsd: 1234.4,
  claimedUsd: 800,
  ratePerDayUsd: 61.7,
  claimDeadline: Date.UTC(2027, 3, 28) / 1000,
  daysLeft: 23,
  updatedAt: 1761800000,
};
const live: LpRewardsSnapshot = { loading: false, live: true, stats: STATS, series: null, error: null, updatedAt: 1 };
const series = Array.from({ length: 6 }, (_, i) => ({ t: 1761796800 + i * 3600, totalWeight: 1, activePositions: 1, distributedUsd: i * i, claimedUsd: 0 }));

const KRE8_LINK = `href="${EARN_LINKS.app}" target="_blank" rel="noopener noreferrer"`;

describe('<BridgeEarnCard>', () => {
  it('live: title, Testnet badge, the three measured numbers, steps, risks and both links', () => {
    const html = renderToStaticMarkup(<BridgeEarnCard state={live} />);
    expect(html).toContain('data-testid="bridge-earn-card"');
    expect(html).toContain('data-live="true"');
    expect(html).toContain('Bridge &amp; Earn');
    expect(html).toContain('class="testnet-tag">Testnet<');
    expect(html).toContain('Bridge ETH to Gully Chain, deposit it into a Gully Core pool');
    expect(html).toContain('data-testid="bridge-earn-stats"');
    expect(html).toMatch(/data-testid="bridge-earn-paid"[\s\S]*?\$1,234</);
    expect(html).toMatch(/data-testid="bridge-earn-participants"[\s\S]*?>42</);
    expect(html).toMatch(/data-testid="bridge-earn-days"[\s\S]*?23 days</);
    expect(html).toContain('$61.70/day right now');
    expect(html).toContain('measured on testnet, not projected');
    for (const s of ['Bridge', 'Deposit', 'Enrol', 'Claim']) expect(html).toContain(`</svg> ${s}</b>`);
    expect(html).toContain('any time until 28 Apr 2027');
    expect(html).toContain('data-testid="bridge-earn-risks"');
    for (const w of EARN_WARNINGS) expect(html).toContain(w.replaceAll('&', '&amp;').replaceAll("'", '&#x27;'));
    expect(html).toContain(KRE8_LINK);
    expect(html).toContain('Open kre8.fun DeFi');
    expect(html).toContain(`href="${EARN_LINKS.docs}"`);
    expect(html).toContain('How it works');
    expect(html).not.toContain('bridge-earn-not-live');
    expect(html).not.toContain('bridge-earn-spark'); // no series yet: no sparkline, no made-up curve
    expect(html).not.toMatch(/APY|APR/);
  });
  it('live with an hourly series: an accessible sparkline of fees paid out per hour', () => {
    const html = renderToStaticMarkup(<BridgeEarnCard state={{ ...live, series }} />);
    expect(html).toContain('data-testid="bridge-earn-spark"');
    expect(html).toContain('<svg class="spark"');
    expect(html).toContain('aria-label="Fees paid out per hour, last 48 hours, USD"');
  });
  it('not live (indexer says live:false): one quiet line and the docs link, no numbers', () => {
    const stats = { ...STATS, live: false };
    const html = renderToStaticMarkup(<BridgeEarnCard state={{ ...live, live: false, stats }} />);
    expect(html).toContain('data-live="false"');
    expect(html).toContain('data-testid="bridge-earn-not-live"');
    expect(html).toContain('is not live on testnet yet.');
    expect(html).toContain(`href="${EARN_LINKS.docs}"`);
    expect(html).not.toContain('bridge-earn-stats');
    expect(html).not.toContain('$1,234');
    expect(html).not.toContain('kre8.fun');
  });
  it('fetch failed (404 or network): the same not-live line, never a broken card', () => {
    const failed: LpRewardsSnapshot = { loading: false, live: false, stats: null, series: null, error: 'Failed to fetch', updatedAt: 0 };
    const html = renderToStaticMarkup(<BridgeEarnCard state={failed} />);
    expect(html).toContain('data-testid="bridge-earn-not-live"');
    expect(html).not.toContain('Failed to fetch');
    expect(html).not.toContain('bridge-earn-stats');
  });
  it('loading: a shimmer, no numbers, no not-live line yet', () => {
    const html = renderToStaticMarkup(<BridgeEarnCard state={INITIAL_SNAPSHOT} />);
    expect(html).toContain('data-testid="bridge-earn-loading"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('bridge-earn-not-live');
    expect(html).not.toContain('bridge-earn-stats');
  });
});

describe('<BridgeEarnDeliveredNotice>', () => {
  const id = '0x' + '7a'.repeat(32);
  it('live: the delivered line, the kre8.fun deep link with the message id (new tab) and the IL warning', () => {
    const html = renderToStaticMarkup(<BridgeEarnDeliveredNotice messageId={id} live />);
    expect(html).toContain('data-testid="bridge-earn-delivered"');
    expect(html).toContain('role="status"');
    expect(html).toContain(EARN_DELIVERED_TEXT);
    expect(html).toContain(`href="${EARN_LINKS.app}&amp;msg=${id}" target="_blank" rel="noopener noreferrer"`);
    expect(html).toContain('Earn with it on kre8.fun');
    expect(html).toContain('impermanent loss');
  });
  it('without a message id the link is the plain kre8.fun entry', () => {
    const html = renderToStaticMarkup(<BridgeEarnDeliveredNotice live />);
    expect(html).toContain(`href="${EARN_LINKS.app}" target="_blank"`);
    expect(html).not.toContain('msg=');
  });
  it('hidden while the program is not live', () => {
    expect(renderToStaticMarkup(<BridgeEarnDeliveredNotice messageId={id} live={false} />)).toBe('');
  });
});
