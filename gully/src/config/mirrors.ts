/**
 * Gully Warp Mirrors: dynamic Fast routes from the same-origin /mirrors.json (gully-ops l3/hyperlane/agents/
 * sync-mirrors.mjs publishes it every minute; schema "gully-warp-mirrors/1", README "Warp mirrors (Gully Core coins)").
 * Each active pair whose destination is a chain this app knows becomes a FastRoute:
 *   gullychaintestnet = the GullyCollateral (EvmHypCollateral, collateralAddress = the coin)
 *   <destination>     = the GullyMirror (EvmHypSynthetic)
 * Directions (types.ts): deposit = destination -> Gully Chain ("Bridge back"), withdraw = Gully Chain -> destination.
 * Pure functions (mirrorRoutes, parseMirrorLink, pickMirrorRoute) are unit-tested in mirrors.test.ts.
 */
import { getAddress, isAddress, type Address } from 'viem';

import { CHAINS, CHILD, type ChainKey } from './chains';
import type { FastRoute } from './routes';

export const MIRRORS_URL = '/mirrors.json';
export const MIRRORS_SCHEMA = 'gully-warp-mirrors/1';

export interface MirrorPair {
  token: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  mirrorName: string | null;
  mirrorSymbol: string | null;
  destination: string | null;
  chainName: string | null;
  chainId: number | null;
  destinationDomain: number;
  collateral: string;
  mirror: string;
  status: 'requested' | 'active' | string;
  relayed?: boolean;
  kre8?: string;
  activateTx?: string | null;
}

export interface MirrorsDoc {
  schema: string;
  generatedAt?: string;
  relayerSyncedAt?: string | null;
  pendingRelayerRestart?: boolean;
  origin?: { chainId: number; domain: number; name?: string; factory?: string | null };
  destinations?: { key: string; chainId: number | null; domain: number; name: string; status: string; factory: string | null; explorer?: string | null }[];
  pairs: MirrorPair[];
}

export interface MirrorMeta {
  originToken: Address;
  /** the app's chain key of the destination (where the mirror trades) */
  chain: ChainKey;
  destinationDomain: number;
  collateral: Address;
  mirror: Address;
  coinName: string;
  coinSymbol: string;
  /** "Trading on <chain> · Launched on Gully Chain · Liquidity on Gully Core" */
  label: string;
  kre8Url: string;
  /** where to check it is the official mirror: the mirror on the destination explorer (factory.originOf proves it) */
  provenanceUrl: string;
  originUrl: string;
  /** relayer whitelist not confirmed yet (sync job restarting the relayer): quotes say "syncing", sends are blocked */
  syncing: boolean;
}

export const mirrorRouteId = (originToken: string, chain: string) => `MIRROR/${originToken.toLowerCase()}/${chain}`;
export const isMirrorRouteId = (id?: string) => !!id && id.startsWith('MIRROR/');
export const mirrorLabel = (chainName: string) => `Trading on ${chainName} · Launched on Gully Chain · Liquidity on Gully Core`;

/** destination chain key of a pair, if the app has that chain (testnet: arbitrumsepolia only) */
function chainOf(p: MirrorPair): ChainKey | undefined {
  const byKey = (Object.keys(CHAINS) as ChainKey[]).find((k) => k !== CHILD && (k === p.destination || k === p.chainName));
  if (byKey) return byKey;
  return (Object.keys(CHAINS) as ChainKey[]).find((k) => k !== CHILD && CHAINS[k].id === Number(p.destinationDomain));
}

/** Map a mirrors.json document to Fast routes. Skips anything not active, not relayed, unknown chains and bad data. */
export function mirrorRoutes(doc: unknown): FastRoute[] {
  const d = doc as MirrorsDoc;
  if (!d || typeof d !== 'object' || d.schema !== MIRRORS_SCHEMA || !Array.isArray(d.pairs)) return [];
  const out: FastRoute[] = [];
  const seen = new Set<string>();
  for (const p of d.pairs) {
    if (!p || p.status !== 'active' || p.relayed === false) continue;
    if (![p.token, p.collateral, p.mirror].every((a) => typeof a === 'string' && isAddress(a, { strict: false }))) continue;
    // the app formats amounts with 18 decimals everywhere; Gully Core coins are 18-decimal ERC-20s
    if (p.decimals !== 18) continue;
    const chain = chainOf(p);
    if (!chain) continue;
    const id = mirrorRouteId(p.token, chain);
    if (seen.has(id)) continue;
    seen.add(id);
    const coin = getAddress(p.token);
    const symbol = p.symbol || 'TOKEN';
    const name = p.name || symbol;
    const mirrorSymbol = p.mirrorSymbol || `g${symbol}`;
    const mirrorName = p.mirrorName || `${name} (${d.origin?.name || 'Gully Chain'})`;
    const mirror = getAddress(p.mirror);
    const collateral = getAddress(p.collateral);
    out.push({
      id,
      symbol,
      tokens: {
        [CHILD]: {
          address: collateral,
          standard: 'EvmHypCollateral',
          tokenType: 'collateral',
          symbol,
          name,
          decimals: 18,
          collateralAddress: coin,
        },
        [chain]: {
          address: mirror,
          standard: 'EvmHypSynthetic',
          tokenType: 'synthetic',
          symbol: mirrorSymbol,
          name: mirrorName,
          decimals: 18,
          collateralAddress: null,
        },
      } as FastRoute['tokens'],
      warp: {
        originToken: coin,
        chain,
        destinationDomain: Number(p.destinationDomain),
        collateral,
        mirror,
        coinName: name,
        coinSymbol: symbol,
        label: mirrorLabel(CHAINS[chain].name),
        kre8Url: p.kre8 && /^https:\/\/kre8\.fun\//.test(p.kre8) ? p.kre8 : `https://kre8.fun/drop/${coin.toLowerCase()}`,
        provenanceUrl: `${CHAINS[chain].explorer}/token/${mirror}`,
        originUrl: `${CHAINS[CHILD].explorer}/token/${coin}`,
        syncing: !!d.pendingRelayerRestart,
      },
    });
  }
  return out;
}

export interface MirrorLink {
  token: Address;
  /** destination domain (= chain id on EVM) or undefined for "any chain the coin has a mirror on" */
  to?: number;
}

/** `?token=<originToken>&to=<domain|chainKey>` -> the requested mirror; undefined when absent or malformed */
export function parseMirrorLink(search: string): MirrorLink | undefined {
  const q = new URLSearchParams(search);
  const token = q.get('token');
  if (!token || !isAddress(token, { strict: false })) return undefined;
  const toRaw = (q.get('to') || '').trim();
  let to: number | undefined;
  if (/^\d{1,10}$/.test(toRaw)) to = Number(toRaw);
  else if (toRaw && toRaw in CHAINS) to = CHAINS[toRaw as ChainKey].id;
  else if (toRaw) return undefined;
  return { token: getAddress(token), to };
}

/** The route a deep link selects among the loaded mirror routes. */
export function pickMirrorRoute(routes: FastRoute[], link?: MirrorLink): FastRoute | undefined {
  if (!link) return undefined;
  return routes.find(
    (r) => r.warp && r.warp.originToken.toLowerCase() === link.token.toLowerCase() && (link.to === undefined || r.warp.destinationDomain === link.to),
  );
}

/** Fetch /mirrors.json (same origin) with a timeout; any failure = no mirror routes (the ETH routes are unaffected). */
export async function fetchMirrorRoutes(url = MIRRORS_URL, timeoutMs = 2500, fetchImpl: typeof fetch = fetch): Promise<FastRoute[]> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(url, { signal: ctl.signal, cache: 'no-cache' });
    if (!r.ok) return [];
    return mirrorRoutes(await r.json());
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}
