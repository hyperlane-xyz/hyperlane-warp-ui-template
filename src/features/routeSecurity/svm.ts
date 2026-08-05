import type { RouteResponse, RouteTx } from '../api/types';
import type { RouteSecurityValidationResult } from './types';
import { isEngineNativeToken } from './utils';

const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const COMPUTE_BUDGET_PROGRAM = 'ComputeBudget111111111111111111111111111111';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

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
  const allowedPreInstructionPrograms = new Set([
    ASSOCIATED_TOKEN_PROGRAM,
    COMPUTE_BUDGET_PROGRAM,
    SYSTEM_PROGRAM,
    TOKEN_PROGRAM,
    TOKEN_2022_PROGRAM,
  ]);
  for (const step of route.steps) {
    if (step.type !== 'bridge') continue;
    allowedPreInstructionPrograms.add(step.router);
    if (!accountKeys.has(step.router)) {
      return { valid: false, reason: 'Sealevel transaction missing bridge router account' };
    }
    if (!isEngineNativeToken(step.asset) && !accountKeys.has(step.asset)) {
      return { valid: false, reason: 'Sealevel transaction missing bridge asset account' };
    }
  }

  for (const preInstruction of tx.preInstructions ?? []) {
    if (!allowedPreInstructionPrograms.has(preInstruction.programId)) {
      return { valid: false, reason: 'Sealevel pre-instruction program is not allowed' };
    }
  }

  return { valid: true };
}
