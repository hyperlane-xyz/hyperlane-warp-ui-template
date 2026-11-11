// Pure formatting for the Bridge & Earn card. Numbers come from the indexer (measured, testnet); nothing is projected.
import { ethN, fmtUsd } from '../bridge/usd';

/** Compact USD ("$1.2K", "$12.40", "$0"); a dash for nothing. */
export function usd(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? '–' : fmtUsd(n);
}

/** Whole count with thousands separators; a dash for nothing. */
export function count(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? '–' : Math.max(0, Math.round(n)).toLocaleString('en-US');
}

/** "12 days", "1 day", "Ends today", "Ended". */
export function daysLeftText(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return '–';
  if (days < 0) return 'Ended';
  const d = Math.floor(days);
  if (d === 0) return 'Ends today';
  return d === 1 ? '1 day' : `${d} days`;
}

/** Measured rate: "$12/day" for USD, "0.0034 ETH/day" for a token amount. */
export function perDay(amount: number | null | undefined, unit: 'USD' | string = 'USD'): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '–';
  return unit === 'USD' ? `${fmtUsd(amount)}/day` : `${ethN(amount)} ${unit}/day`;
}

/** "until 28 Apr 2027" from a unix timestamp in seconds (or ms); generic text when unknown. */
export function claimDeadlineText(ts: number | null | undefined): string {
  if (ts === null || ts === undefined || !Number.isFinite(ts) || ts <= 0) return 'until the claim deadline';
  const ms = ts > 1e12 ? ts : ts * 1000;
  return `until ${new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
}

/** Per-interval amounts from a cumulative series (never negative; a reset or re-index shows as 0). */
export function hourlyDeltas(cumulative: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < cumulative.length; i++) out.push(Math.max(0, cumulative[i] - cumulative[i - 1]));
  return out;
}
