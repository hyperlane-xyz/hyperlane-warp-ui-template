import type { RouteResponse, RouteTx } from '../api/types';
import type { RouteSecurityValidationResult } from './types';
import { isEngineNativeToken } from './utils';

export function validateSealevelRouteTx(
  route: RouteResponse,
  tx: Extract<RouteTx, { to: string }>,
  trustedUniversalRouter: string,
): RouteSecurityValidationResult {
  if (tx.to !== trustedUniversalRouter) {
    return { valid: false, reason: 'Sealevel transaction target does not match universal router' };
  }

  if (!tx.accounts?.length) {
    return { valid: false, reason: 'Sealevel transaction missing accounts' };
  }

  const accountKeys = new Set(tx.accounts.map((account) => account.pubkey));
  for (const step of route.steps) {
    if (step.type !== 'bridge') continue;
    if (!accountKeys.has(step.router)) {
      return { valid: false, reason: 'Sealevel transaction missing bridge router account' };
    }
    if (!isEngineNativeToken(step.asset) && !accountKeys.has(step.asset)) {
      return { valid: false, reason: 'Sealevel transaction missing bridge asset account' };
    }
  }

  return { valid: true };
}
