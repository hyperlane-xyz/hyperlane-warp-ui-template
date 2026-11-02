// Network switch for the bridge build: VITE_NETWORK=testnet (default, unchanged live testnet bridge) or mainnet
// (Gully Chain 48559 on Arbitrum One, src/config/mainnet.json + VITE_MAINNET_* overrides). Pure: unit-tested in
// network.test.ts. The chain keys stay 'arbitrumsepolia' (the parent slot) and 'gullychaintestnet' (the Gully Chain
// slot) on both networks so routes.json, sync-routes.mjs and every caller keep working; only the values change.
import { getAddress, isAddress, parseEther, type Address } from 'viem';

import mainnet from './mainnet.json';

export type Network = 'testnet' | 'mainnet';

export const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

/** Unknown values fail the build instead of silently shipping testnet as mainnet (or the reverse). */
export function parseNetwork(v?: string | null): Network {
  const s = (v ?? '').trim().toLowerCase();
  if (s === '' || s === 'testnet') return 'testnet';
  if (s === 'mainnet') return 'mainnet';
  throw new Error(`VITE_NETWORK must be testnet or mainnet, not "${v}"`);
}

/** A checksummed address, or null for anything unset, malformed or the zero address. */
export function addr(v: unknown): Address | null {
  if (typeof v !== 'string' || !isAddress(v.trim(), { strict: false })) return null;
  const a = getAddress(v.trim());
  return a === ZERO_ADDRESS ? null : a;
}

export const isSet = (a: Address | null | undefined): a is Address => !!a && a !== ZERO_ADDRESS;

const big = (v: unknown): bigint | null => {
  if (v === null || v === undefined || v === '') return null;
  try {
    const b = BigInt(String(v).trim());
    return b >= 0n ? b : null;
  } catch {
    return null;
  }
};
const eth = (v: unknown): bigint | null => {
  if (v === null || v === undefined || v === '') return null;
  try {
    const b = parseEther(String(v).trim());
    return b > 0n ? b : null;
  } catch {
    return null;
  }
};

/** Phase 1 caps in wei; null = no cap. */
export interface Caps {
  /** Fast lane (Hyperlane), largest single transfer */
  fastPerTransfer: bigint | null;
  /** Fast lane (Hyperlane), most ETH the parent-chain router may hold (collateral); deposits above it are refused */
  fastRouteCollateral: bigint | null;
  /** Fast lane, per 24 h: PLAN.md names no number, so null; enforced on chain only (rate-limited ISM/hook), never in the UI */
  fastDaily: bigint | null;
  /** Canonical lane: soft cap on ETH held by the Nitro bridge; deposits that would cross it are refused in the UI */
  canonicalSoftCap: bigint | null;
}

export const NO_CAPS: Caps = { fastPerTransfer: null, fastRouteCollateral: null, fastDaily: null, canonicalSoftCap: null };

export interface MainnetOverrides {
  VITE_MAINNET_INBOX?: string;
  VITE_MAINNET_BRIDGE?: string;
  VITE_MAINNET_OUTBOX?: string;
  VITE_MAINNET_ROLLUP?: string;
  VITE_MAINNET_CHILD_MAILBOX?: string;
  VITE_MAINNET_FAST_PARENT_ROUTER?: string;
  VITE_MAINNET_FAST_CHILD_ROUTER?: string;
  VITE_MAINNET_PARENT_FROM_BLOCK?: string;
  VITE_MAINNET_FAST_FROM_BLOCK?: string;
}

export interface MainnetConfig {
  inbox: Address | null;
  bridge: Address | null;
  outbox: Address | null;
  rollup: Address | null;
  parentMailbox: Address | null;
  childMailbox: Address | null;
  fastParentRouter: Address | null;
  fastChildRouter: Address | null;
  parentFromBlock: bigint | null;
  fastFromBlock: bigint | null;
  confirmPeriodBlocks: bigint;
  caps: Caps;
}

/** mainnet.json with the VITE_MAINNET_* build env on top (env wins when it holds a valid value). */
export function mainnetConfig(env: MainnetOverrides = {}, json: typeof mainnet = mainnet): MainnetConfig {
  const pick = (e: string | undefined, j: unknown) => addr(e) ?? addr(j);
  const r = json.routes.find((x) => x.id === json.defaultRouteId);
  return {
    inbox: pick(env.VITE_MAINNET_INBOX, json.canonical.inbox),
    bridge: pick(env.VITE_MAINNET_BRIDGE, json.canonical.bridge),
    outbox: pick(env.VITE_MAINNET_OUTBOX, json.canonical.outbox),
    rollup: pick(env.VITE_MAINNET_ROLLUP, json.canonical.rollup),
    parentMailbox: addr(json.parent.mailbox),
    childMailbox: pick(env.VITE_MAINNET_CHILD_MAILBOX, json.child.mailbox),
    fastParentRouter: pick(env.VITE_MAINNET_FAST_PARENT_ROUTER, r?.tokens.arbitrumsepolia.address),
    fastChildRouter: pick(env.VITE_MAINNET_FAST_CHILD_ROUTER, r?.tokens.gullychaintestnet.address),
    parentFromBlock: big(env.VITE_MAINNET_PARENT_FROM_BLOCK) ?? big(json.parent.fromBlock),
    fastFromBlock: big(env.VITE_MAINNET_FAST_FROM_BLOCK) ?? big(json.parent.fastFromBlock),
    confirmPeriodBlocks: big(json.canonical.confirmPeriodBlocks) ?? 50400n,
    caps: {
      fastPerTransfer: eth(json.caps.fastPerTransferEth),
      fastRouteCollateral: eth(json.caps.fastRouteCollateralEth),
      fastDaily: eth(json.caps.fastDailyEth),
      canonicalSoftCap: eth(json.caps.canonicalSoftCapEth),
    },
  };
}

/** Canonical lane needs all four Nitro core contracts. */
export const canonicalReady = (m: Pick<MainnetConfig, 'inbox' | 'bridge' | 'outbox' | 'rollup'>) =>
  isSet(m.inbox) && isSet(m.bridge) && isSet(m.outbox) && isSet(m.rollup);

/** Fast lane needs both mailboxes, both routers and the parent block the routers were deployed at (log scans). */
export const fastReady = (m: MainnetConfig) =>
  isSet(m.parentMailbox) && isSet(m.childMailbox) && isSet(m.fastParentRouter) && isSet(m.fastChildRouter) && m.fastFromBlock !== null;

// plain import.meta.env: Vite replaces it at build time and vitest's stubEnv patches it in tests
const env = import.meta.env as unknown as Record<string, string | undefined>;

export const NETWORK: Network = parseNetwork(env.VITE_NETWORK);
export const IS_TESTNET = NETWORK === 'testnet';
export const MAINNET = mainnetConfig(env as MainnetOverrides);
/** Phase 1 caps apply on mainnet only; the testnet bridge keeps no caps (test ETH, liquidity check only). */
export const CAPS: Caps = IS_TESTNET ? NO_CAPS : MAINNET.caps;
