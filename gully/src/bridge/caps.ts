// Phase 1 guarded-launch caps (gully-ops l3/mainnet/PLAN.md "Phase 1 guarded-launch caps", owner decision D-CAPS),
// enforced in the UI: a quote over a cap comes back unavailable, so the button is disabled and shows the reason, and
// pickRoute falls back to the other lane. Pure: unit-tested in caps.test.ts. Testnet has no caps (CAPS = NO_CAPS).
import { formatEther } from 'viem';

import type { Caps } from '../config/network';
import type { Direction, RouteKind } from './types';

export interface CapInput {
  kind: RouteKind;
  direction: Direction;
  amount: bigint;
  /**
   * ETH the parent-chain side already holds: the Fast lane's Arbitrum router (its collateral) for kind 'fast', the
   * Nitro bridge contract for kind 'canonical'. undefined = could not be read.
   */
  parentLocked?: bigint;
}

export interface CapResult {
  ok: boolean;
  reason?: string;
}

const e = (v: bigint) => {
  const s = formatEther(v);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};

/** Do the caps need the parent-side balance for this transfer? (deposits only: withdrawals lower it) */
export function needsParentLocked(caps: Caps, kind: RouteKind, direction: Direction): boolean {
  if (direction !== 'deposit') return false;
  return kind === 'fast' ? caps.fastRouteCollateral !== null : caps.canonicalSoftCap !== null;
}

export function checkCaps(caps: Caps, c: CapInput): CapResult {
  if (c.kind === 'fast') {
    if (caps.fastPerTransfer !== null && c.amount > caps.fastPerTransfer)
      return { ok: false, reason: `Fast lane limit: ${e(caps.fastPerTransfer)} ETH per transfer during Phase 1` };
    if (needsParentLocked(caps, 'fast', c.direction)) {
      // fail closed: if the router's balance cannot be read, the cap cannot be checked, so nothing is sent
      if (c.parentLocked === undefined) return { ok: false, reason: 'Could not check the Fast lane cap. Try again.' };
      if (c.parentLocked + c.amount > caps.fastRouteCollateral!)
        return {
          ok: false,
          reason: `Fast lane is full: ${e(caps.fastRouteCollateral!)} ETH cap during Phase 1 (${e(c.parentLocked)} ETH bridged)`,
        };
    }
    return { ok: true };
  }
  if (needsParentLocked(caps, 'canonical', c.direction)) {
    if (c.parentLocked === undefined) return { ok: false, reason: 'Could not check the canonical bridge cap. Try again.' };
    if (c.parentLocked + c.amount > caps.canonicalSoftCap!)
      return {
        ok: false,
        reason: `Canonical bridge is at its ${e(caps.canonicalSoftCap!)} ETH Phase 1 cap (${e(c.parentLocked)} ETH bridged)`,
      };
  }
  return { ok: true };
}

/** The limits as short lines for the card (empty when there are no caps, as on testnet). */
export function capLines(caps: Caps): string[] {
  const out: string[] = [];
  if (caps.fastPerTransfer !== null) out.push(`Fast lane: up to ${e(caps.fastPerTransfer)} ETH per transfer`);
  if (caps.fastRouteCollateral !== null) out.push(`Fast lane: ${e(caps.fastRouteCollateral)} ETH in total`);
  // caps.fastDaily is enforced on chain only (Hyperlane rate-limited ISM/hook); the UI has no per-wallet 24 h history
  if (caps.canonicalSoftCap !== null) out.push(`Canonical bridge: ${e(caps.canonicalSoftCap)} ETH in total`);
  return out;
}
