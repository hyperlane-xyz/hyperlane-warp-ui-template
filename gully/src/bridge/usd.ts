/**
 * ETH/USD for display (owner rule: USD first wherever money appears, compact "$50K", ETH as the secondary line).
 * Testnet ETH has no value: every $ here is the test ETH amount at the *mainnet* ETH price. Nothing is made up: with
 * no fresh price the bridge shows ETH only.
 *
 * Sources, in order (Gully RPC fallback contract, 2026-10-26; no CoinGecko calls from the browser):
 * 1. Gully's ETH/USD endpoint `GET /price/eth`: same-origin on a gullychain.xyz host, else https://gullychain.xyz
 *    (server-side cache of 60 s, CORS *).
 * 2. RedStone's public price API (redstone-primary-prod, the data GullyPriceFeed verifies on chain).
 * 3. GullyPriceFeed on GullyChain, read through the GullyChain RPC fallback transport.
 * Cached for 60 s and refreshed every 60 s while the page is open.
 */
import { useSyncExternalStore } from 'react';
import { formatUnits, stringToHex } from 'viem';

import { IS_TESTNET } from '../config/network';
import { gullyPriceUrl } from '../config/rpc';
import { pub } from './clients';

export interface EthUsd {
  /** USD per 1 ETH (mainnet price) */
  usd: number;
  /** data timestamp, ms */
  at: number;
  source: 'Gully price API' | 'RedStone API' | 'GullyPriceFeed';
}

export const REDSTONE_PRICE_URL = 'https://api.redstone.finance/prices?symbols=ETH&provider=redstone-primary-prod';
/** GullyPriceFeed v1.0.0 on chain 485590 (RedStone primary-prod, 8 decimals) */
export const PRICE_FEED = '0x4c64c79ee59a83842a22c14712D66bfef48eb301' as const;
/** older than this and the price is not shown */
export const MAX_AGE_MS = 15 * 60_000;
export const CACHE_MS = 60_000;

export const USD_NOTE = IS_TESTNET ? 'USD at mainnet ETH price; testnet tokens have no real value' : 'USD at the ETH price';

const priceFeedAbi = [
  {
    type: 'function',
    name: 'latestPrice',
    stateMutability: 'view',
    inputs: [{ name: 'feedId', type: 'bytes32' }],
    outputs: [
      { name: 'value', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'round', type: 'uint80' },
    ],
  },
] as const;

const sane = (usd: unknown): usd is number => typeof usd === 'number' && Number.isFinite(usd) && usd > 0 && usd < 1e7;
const fresh = (at: number, now: number) => now - at <= MAX_AGE_MS && at - now <= 5 * 60_000;

/** RedStone's JSON ({ ETH: { value, timestamp } }); null on anything odd or stale. */
export function parseRedstone(json: unknown, now = Date.now()): EthUsd | null {
  const e = (json as { ETH?: { value?: unknown; timestamp?: unknown } } | null)?.ETH;
  if (!e || !sane(e.value) || typeof e.timestamp !== 'number' || !fresh(e.timestamp, now)) return null;
  return { usd: e.value, at: e.timestamp, source: 'RedStone API' };
}

/** Gully's /price/eth JSON ({ symbol: 'ETH', usd, source, ts } with ts in seconds); null on anything odd or stale. */
export function parseGullyPrice(json: unknown, now = Date.now()): EthUsd | null {
  const e = json as { symbol?: unknown; usd?: unknown; ts?: unknown } | null;
  if (!e || (e.symbol !== undefined && e.symbol !== 'ETH') || !sane(e.usd) || typeof e.ts !== 'number') return null;
  const at = e.ts * 1000;
  return fresh(at, now) ? { usd: e.usd, at, source: 'Gully price API' } : null;
}

async function getJson(url: string): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function fromFeed(): Promise<EthUsd | null> {
  if (!IS_TESTNET) return null; // the feed is a testnet contract (485590); the mainnet build uses the price APIs only
  const [value, ts] = await pub('gullychaintestnet').readContract({ address: PRICE_FEED, abi: priceFeedAbi, functionName: 'latestPrice', args: [stringToHex('ETH', { size: 32 })] });
  const at = Number(ts) * 1000;
  const usd = Number(value) / 1e8;
  return sane(usd) && fresh(at, Date.now()) ? { usd, at, source: 'GullyPriceFeed' } : null;
}

export async function fetchEthUsd(): Promise<EthUsd | null> {
  const sources: (() => Promise<EthUsd | null>)[] = [
    async () => parseGullyPrice(await getJson(gullyPriceUrl())),
    async () => parseRedstone(await getJson(REDSTONE_PRICE_URL)),
    fromFeed,
  ];
  for (const s of sources) {
    try {
      const p = await s();
      if (p) return p;
    } catch {
      /* next source */
    }
  }
  return null;
}

// ---------------------------------------------------------------- formatting (same as gully-explorer)

const trimZ = (s: string) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const SUBS = '₀₁₂₃₄₅₆₇₈₉';

/** 3 significant digits below 1; 4+ leading zeros as a subscript count ("0.0₆335"). */
export function tinyNum(a: number, sig = 3): string {
  let e = Math.floor(Math.log10(a));
  let m = Math.round(a / 10 ** (e - sig + 1));
  if (m >= 10 ** sig) {
    m = Math.round(m / 10);
    e += 1;
  }
  if (e >= 0) return '1';
  const zeros = -e - 1;
  const digits = String(m).replace(/0+$/, '') || '0';
  if (zeros < 4) return `0.${'0'.repeat(zeros)}${digits}`;
  return `0.0${[...String(zeros)].map((d) => SUBS[Number(d)]).join('')}${digits}`;
}

/** An ETH amount for reading: "1,234", "1.2346", "0.0123", "0.0₆335". */
export function ethN(n: number): string {
  if (!Number.isFinite(n)) return '–';
  const a = Math.abs(n);
  if (a === 0) return '0';
  const sign = n < 0 ? '-' : '';
  if (a >= 1000) return sign + nf0.format(Math.round(a));
  if (a >= 1) return sign + trimZ(a.toFixed(4));
  return sign + tinyNum(a);
}

/** Digits of a value below 1: 3 significant digits, "0.50" for cents, 4+ leading zeros as a subscript. */
export function tinyDigits(a: number, sig = 3): string {
  const s = tinyNum(a, sig);
  return /^0\.\d$/.test(s) ? `${s}0` : s;
}

/** Compact USD: "$50K", "$1.2M", "$123.45", "$0.078", "$0.0₄12". */
export function fmtUsd(n: number, sig = 3): string {
  if (!Number.isFinite(n)) return '–';
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a === 0) return '$0';
  const unit = (v: number, u: string) => `${sign}$${trimZ(v.toFixed(v < 100 ? 1 : 0))}${u}`;
  if (a >= 1e12) return unit(a / 1e12, 'T');
  if (a >= 1e9) return unit(a / 1e9, 'B');
  if (a >= 1e6) return unit(a / 1e6, 'M');
  if (a >= 1e4) return unit(a / 1e3, 'K');
  if (a >= 1000) return `${sign}$${a.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (a >= 1) return `${sign}$${a.toFixed(2)}`;
  return `${sign}$${tinyDigits(a, sig)}`;
}

/** wei (bigint) or ETH (number) as an ETH number */
export const asEth = (v: bigint | number, decimals = 18): number => (typeof v === 'bigint' ? Number(formatUnits(v, decimals)) : v);

/** USD value of an ETH amount, or null when there is no price. */
export const toUsd = (eth: number | null | undefined, p: EthUsd | null): number | null =>
  p && eth !== null && eth !== undefined && Number.isFinite(eth) ? eth * p.usd : null;

export function usdTitle(p: EthUsd | null): string {
  return p ? `${USD_NOTE}. ETH/USD ${fmtUsd(p.usd)} from ${p.source}, ${new Date(p.at).toLocaleTimeString()}.` : `${USD_NOTE}. No ETH/USD price right now, so amounts show in ETH.`;
}

// ---------------------------------------------------------------- live store (one fetch loop for the app)

let price: EthUsd | null = null;
let fetchedAt = 0;
let inflight: Promise<EthUsd | null> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

/** Cached price (60 s); one request in flight at a time. */
export function loadEthUsd(force = false): Promise<EthUsd | null> {
  if (!force && fetchedAt && Date.now() - fetchedAt < CACHE_MS) return Promise.resolve(price);
  if (!inflight)
    inflight = fetchEthUsd()
      .then((p) => {
        // keep the last good price while it is still fresh enough; never invent one
        if (p) price = p;
        else if (price && !fresh(price.at, Date.now())) price = null;
        fetchedAt = Date.now();
        for (const l of listeners) l();
        return price;
      })
      .finally(() => {
        inflight = null;
      });
  return inflight;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!timer && typeof window !== 'undefined') {
    void loadEthUsd();
    timer = setInterval(() => void loadEthUsd(true), CACHE_MS);
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export const ethUsdSync = () => price;

/** The live ETH/USD price, or null (show ETH only). */
export function useEthUsd(): EthUsd | null {
  return useSyncExternalStore(subscribe, ethUsdSync, () => null);
}
