import type { RouteResponse, RouteTx } from '../api/types';
import type { RouteSecurityValidationResult } from './types';
import { isEngineNativeToken } from './utils';

const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const COMPUTE_BUDGET_PROGRAM = 'ComputeBudget111111111111111111111111111111';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const ATA_CREATE_IDEMPOTENT_DISCRIMINATOR = 1;
const COMPUTE_BUDGET_DISCRIMINATORS = new Set([1, 2, 3, 4]);

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

  for (const preInstruction of tx.preInstructions ?? []) {
    if (!isAllowedPreInstruction(preInstruction)) {
      return { valid: false, reason: 'Sealevel pre-instruction program is not allowed' };
    }
  }

  return { valid: true };
}

function isAllowedPreInstruction(
  instruction: NonNullable<Extract<RouteTx, { to: string }>['preInstructions']>[number],
): boolean {
  if (instruction.programId === COMPUTE_BUDGET_PROGRAM) {
    const data = decodeBase64(instruction.data);
    return (
      instruction.accounts.length === 0 &&
      data.length > 0 &&
      COMPUTE_BUDGET_DISCRIMINATORS.has(data[0]!)
    );
  }

  if (instruction.programId !== ASSOCIATED_TOKEN_PROGRAM) return false;

  const data = decodeBase64(instruction.data);
  if (data.length !== 1 || data[0] !== ATA_CREATE_IDEMPOTENT_DISCRIMINATOR) return false;
  const [payer, ata, owner, mint, systemProgram, tokenProgram] = instruction.accounts;
  return (
    instruction.accounts.length === 6 &&
    !!payer?.isSigner &&
    !!payer.isWritable &&
    !ata?.isSigner &&
    !!ata?.isWritable &&
    !owner?.isSigner &&
    !mint?.isSigner &&
    !systemProgram?.isSigner &&
    systemProgram?.pubkey === SYSTEM_PROGRAM &&
    !tokenProgram?.isSigner &&
    (tokenProgram?.pubkey === TOKEN_PROGRAM || tokenProgram?.pubkey === TOKEN_2022_PROGRAM)
  );
}

function decodeBase64(value: string): Uint8Array {
  try {
    if (typeof atob === 'function') {
      const bin = atob(value);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }
    return Uint8Array.from(Buffer.from(value, 'base64'));
  } catch {
    return new Uint8Array();
  }
}
