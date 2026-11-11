// Which tokens can move between Gully Chain and each other chain, and which are live. Pure: unit-tested in
// lanes.test.ts. "Classic" is the live native ETH route with Arbitrum Sepolia (plus the canonical Orbit bridge, the
// Cheapest lane); "multichain" are the manifest routes (gully-ops l3/hyperlane/multichain/routes.yaml).
import { CHAINS, CHILD, PARENT, type ChainKey } from '../config/chains';
import { DEFAULT_FAST_ROUTE_ID, FAST_ROUTES, type FastRoute } from '../config/routes';
import { MANIFEST_CHAINS, MC_ROUTES, REMOTE_CHAINS, type McRoute, type McToken } from '../config/multichain';
import type { Direction } from './types';

export interface LaneToken extends McToken {
  chain: ChainKey;
}

export interface TokenOption {
  /** route id (classic or multichain) */
  id: string;
  source: 'classic' | 'multichain';
  /** the chain on the other side of Gully Chain */
  remote: ChainKey;
  direction: Direction;
  from: ChainKey;
  to: ChainKey;
  send: LaneToken;
  receive: LaneToken;
  /** both routers are deployed: the token can be sent. false = "Coming soon" */
  live: boolean;
  /** a Cheapest lane exists for this token (the canonical Arbitrum bridge moves ETH only) */
  canonical: boolean;
}

export interface LaneSources {
  classic: FastRoute[];
  defaultClassicId: string;
  multichain: McRoute[];
  /** chains with a canonical bridge to Gully Chain (manifest `canonical: true`) */
  canonicalChains: ChainKey[];
}

export const DEFAULT_SOURCES: LaneSources = {
  classic: FAST_ROUTES,
  defaultClassicId: DEFAULT_FAST_ROUTE_ID,
  multichain: MC_ROUTES,
  canonicalChains: [
    PARENT,
    ...Object.entries(MANIFEST_CHAINS)
      .filter(([, c]) => c.canonical)
      .map(([k]) => k as ChainKey),
  ],
};

export function endsOf(remote: ChainKey, direction: Direction): { from: ChainKey; to: ChainKey } {
  return direction === 'deposit' ? { from: remote, to: CHILD } : { from: CHILD, to: remote };
}

/** Every token that moves between `remote` and Gully Chain in `direction`, classic first, then manifest order. */
export function tokenOptions(remote: ChainKey, direction: Direction, src: LaneSources = DEFAULT_SOURCES): TokenOption[] {
  const { from, to } = endsOf(remote, direction);
  const out: TokenOption[] = [];
  const canonicalChain = src.canonicalChains.includes(remote);
  if (remote === PARENT) {
    const r = src.classic.find((x) => x.id === src.defaultClassicId && !x.legacy);
    if (r) {
      const t = (chain: ChainKey): LaneToken => ({ ...r.tokens[chain as 'arbitrumsepolia'], chain });
      out.push({ id: r.id, source: 'classic', remote, direction, from, to, send: t(from), receive: t(to), live: true, canonical: canonicalChain });
    }
  }
  for (const r of src.multichain) {
    const a = r.tokens[from];
    const b = r.tokens[to];
    if (!a || !b) continue;
    out.push({
      id: r.id,
      source: 'multichain',
      remote,
      direction,
      from,
      to,
      send: { ...a, chain: from },
      receive: { ...b, chain: to },
      live: !!a.address && !!b.address,
      canonical: false,
    });
  }
  return out;
}

/** The option to show: the wanted id when the chain has it, else the first live one, else the first. */
export function pickOption(options: TokenOption[], wantedId?: string): TokenOption | undefined {
  return options.find((o) => o.id === wantedId) || options.find((o) => o.live) || options[0];
}

/** live = at least one token can be sent today; soon = routes planned, none deployed; none = no route at all */
export function chainStatus(remote: ChainKey, src: LaneSources = DEFAULT_SOURCES): 'live' | 'soon' | 'none' {
  const opts = tokenOptions(remote, 'deposit', src);
  if (!opts.length) return 'none';
  return opts.some((o) => o.live) ? 'live' : 'soon';
}

/** Chains the picker lists: every chain with a route to Gully Chain (live or planned). */
export function pickerChains(src: LaneSources = DEFAULT_SOURCES): ChainKey[] {
  return REMOTE_CHAINS.filter((c) => chainStatus(c, src) !== 'none');
}

/** True when the token is native gas on the receiving chain (ETH on Gully Chain, SOL on Solana...). */
export function receivesGas(o: TokenOption) {
  return o.receive.tokenType === 'native';
}

/** amount in `fromDecimals` units expressed in `toDecimals` units (rounded down) */
export function convertDecimals(amount: bigint, fromDecimals: number, toDecimals: number): bigint {
  if (fromDecimals === toDecimals) return amount;
  return fromDecimals > toDecimals
    ? amount / 10n ** BigInt(fromDecimals - toDecimals)
    : amount * 10n ** BigInt(toDecimals - fromDecimals);
}

export function chainName(c: ChainKey) {
  return CHAINS[c].name;
}
