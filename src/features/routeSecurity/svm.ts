import type { RouteResponse, RouteTx } from '../api/types';
import type { RouteSecurityValidationResult } from './types';
import { isEngineNativeToken } from './utils';

export function validateSealevelRouteTx(
  route: RouteResponse,
  tx: Extract<RouteTx, { to: string }>,
): RouteSecurityValidationResult {
  // TODO: Pin tx.to (the invoked programId) once registry/local trusted SVM
  // universal-router program data exists. Account checks below only prove the
  // expected warp accounts are present; they do not prove the invoked program
  // is trusted.
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
