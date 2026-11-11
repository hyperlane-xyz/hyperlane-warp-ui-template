import { describe, expect, it } from 'vitest';

import { EARN_LINKS, earnDeepLink } from './copy';
import { claimDeadlineText, count, daysLeftText, hourlyDeltas, perDay, usd } from './format';

describe('Bridge & Earn formatting', () => {
  it('usd: compact, two decimals under $1,000, a dash for nothing', () => {
    expect(usd(0)).toBe('$0');
    expect(usd(12.4)).toBe('$12.40');
    expect(usd(1234.4)).toBe('$1,234');
    expect(usd(52_000)).toBe('$52K');
    expect(usd(null)).toBe('–');
    expect(usd(Number.NaN)).toBe('–');
  });
  it('count: whole numbers with separators', () => {
    expect(count(1234)).toBe('1,234');
    expect(count(0)).toBe('0');
    expect(count(undefined)).toBe('–');
  });
  it('daysLeftText', () => {
    expect(daysLeftText(23)).toBe('23 days');
    expect(daysLeftText(1.9)).toBe('1 day');
    expect(daysLeftText(0.4)).toBe('Ends today');
    expect(daysLeftText(-1)).toBe('Ended');
    expect(daysLeftText(null)).toBe('–');
  });
  it('perDay: USD or a token amount', () => {
    expect(perDay(12)).toBe('$12.00/day');
    expect(perDay(0)).toBe('$0/day');
    expect(perDay(0.0034, 'ETH')).toBe('0.0034 ETH/day');
    expect(perDay(undefined)).toBe('–');
  });
  it('claimDeadlineText: a date from unix seconds, generic text when unknown', () => {
    expect(claimDeadlineText(Date.UTC(2027, 3, 28) / 1000)).toBe('until 28 Apr 2027');
    expect(claimDeadlineText(Date.UTC(2027, 3, 28))).toBe('until 28 Apr 2027'); // ms accepted too
    expect(claimDeadlineText(null)).toBe('until the claim deadline');
    expect(claimDeadlineText(0)).toBe('until the claim deadline');
  });
  it('hourlyDeltas: per-hour amounts from a cumulative series, never negative', () => {
    expect(hourlyDeltas([0, 1, 3, 2, 5])).toEqual([1, 2, 0, 3]);
    expect(hourlyDeltas([7])).toEqual([]);
  });
  it('earnDeepLink: carries a valid message id, otherwise the plain kre8.fun link', () => {
    const id = '0x' + 'ab'.repeat(32);
    expect(earnDeepLink(id)).toBe(`${EARN_LINKS.app}&msg=${id}`);
    expect(earnDeepLink('0x' + 'AB'.repeat(32))).toBe(`${EARN_LINKS.app}&msg=${id}`);
    expect(earnDeepLink('0x1234')).toBe(EARN_LINKS.app);
    expect(earnDeepLink(undefined)).toBe(EARN_LINKS.app);
    expect(EARN_LINKS.app).toBe('https://kre8.fun/me/wallet/defi?earn=bridge');
  });
});
