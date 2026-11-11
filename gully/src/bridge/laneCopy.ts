// Plain-words copy for the Fast / Cheapest toggle. Pure: unit-tested in laneCopy.test.ts. No jargon here: "Hyperlane"
// and "ISM" belong in the details, never on the main path.
import type { Direction, RouteKind } from './types';

/** "about 45 minutes", "about 7 days" */
export function inWords(seconds: number): string {
  if (seconds < 90) return 'about a minute';
  const min = Math.round(seconds / 60);
  if (min < 90) return `about ${min} minutes`;
  const h = Math.round(seconds / 3600);
  if (h < 36) return `about ${h} hour${h === 1 ? '' : 's'}`;
  const d = Math.round(seconds / 86400);
  return `about ${d} day${d === 1 ? '' : 's'}`;
}

export interface LaneCopyInput {
  kind: RouteKind;
  direction: Direction;
  /** name of the chain on the other side of Gully Chain */
  remoteName: string;
  /** canonical withdrawal time (challenge period + claim window), seconds */
  withdrawSeconds?: number;
}

export interface LaneCopy {
  title: string;
  /** one sentence: time and fee */
  line: string;
}

export function laneCopy(i: LaneCopyInput): LaneCopy {
  if (i.kind === 'fast')
    return { title: 'Fast', line: 'Fast: about 1 to 3 minutes. You pay network gas plus a small delivery fee.' };
  if (i.direction === 'deposit')
    return {
      title: 'Cheapest',
      line: 'Cheapest: the canonical Arbitrum bridge. Deposits arrive in about a minute. No bridge fee, you pay network gas only.',
    };
  return {
    title: 'Cheapest',
    line: `Cheapest: the canonical Arbitrum bridge. Withdrawals take ${inWords(i.withdrawSeconds ?? 7 * 86400)} (a safety window), then you claim on ${i.remoteName} with one more transaction. No bridge fee.`,
  };
}

/** Why there is no Cheapest option for this chain or token. */
export function cheapestUnavailable(remoteName: string, symbol: string, canonicalChain: boolean): string {
  if (canonicalChain)
    return `Cheapest only moves ETH (it is the canonical Arbitrum bridge). ${symbol} always goes through the fast lane.`;
  return `${remoteName} has one lane: Fast. There is no canonical bridge between ${remoteName} and Gully Chain, so the fast lane is the only one.`;
}
