import { PublicKey } from '@solana/web3.js';

import type { RouteResponse, RouteTx } from '../api/types';
import type { RouteSecurityValidationResult } from './types';
import { isEngineNativeToken, sameTokenAddress } from './utils';

const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const COMPUTE_BUDGET_PROGRAM = 'ComputeBudget111111111111111111111111111111';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const ATA_CREATE_IDEMPOTENT_DISCRIMINATOR = 1;
const COMPUTE_BUDGET_SET_UNIT_LIMIT_DISCRIMINATOR = 2;
const MAX_COMPUTE_UNIT_LIMIT = 1_400_000;
const MAX_ATA_PRE_INSTRUCTIONS = 4;

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

  const routeMints = sourceRouteMints(route);
  let ataPreInstructionCount = 0;
  for (const preInstruction of tx.preInstructions ?? []) {
    if (preInstruction.programId === ASSOCIATED_TOKEN_PROGRAM) ataPreInstructionCount += 1;
    if (ataPreInstructionCount > MAX_ATA_PRE_INSTRUCTIONS) {
      return { valid: false, reason: 'Sealevel route has too many ATA pre-instructions' };
    }
    if (!isAllowedPreInstruction(preInstruction, routeMints)) {
      return { valid: false, reason: 'Sealevel pre-instruction program is not allowed' };
    }
  }

  return { valid: true };
}

function isAllowedPreInstruction(
  instruction: NonNullable<Extract<RouteTx, { to: string }>['preInstructions']>[number],
  routeMints: string[],
): boolean {
  if (instruction.programId === COMPUTE_BUDGET_PROGRAM) {
    const data = decodeBase64(instruction.data);
    if (instruction.accounts.length !== 0) return false;
    if (data.length !== 5 || data[0] !== COMPUTE_BUDGET_SET_UNIT_LIMIT_DISCRIMINATOR) return false;
    return readUint32LE(data, 1) <= MAX_COMPUTE_UNIT_LIMIT;
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
    !owner.isWritable &&
    !mint?.isSigner &&
    !mint.isWritable &&
    !systemProgram?.isSigner &&
    !systemProgram.isWritable &&
    systemProgram?.pubkey === SYSTEM_PROGRAM &&
    !tokenProgram?.isSigner &&
    !tokenProgram.isWritable &&
    (tokenProgram?.pubkey === TOKEN_PROGRAM || tokenProgram?.pubkey === TOKEN_2022_PROGRAM) &&
    payer.pubkey === owner.pubkey &&
    routeMints.some((routeMint) => sameTokenAddress(routeMint, mint.pubkey)) &&
    ata.pubkey === deriveAssociatedTokenAddress(owner.pubkey, mint.pubkey, tokenProgram.pubkey)
  );
}

function sourceRouteMints(route: RouteResponse): string[] {
  const sourceChain = route.steps[0]?.chain;
  if (sourceChain == null) return [];
  const mints = new Set<string>();
  for (const step of route.steps) {
    if (step.chain !== sourceChain) continue;
    if (step.type === 'bridge') {
      if (!isEngineNativeToken(step.asset)) mints.add(step.asset);
    } else {
      if (!isEngineNativeToken(step.tokenIn)) mints.add(step.tokenIn);
      if (!isEngineNativeToken(step.tokenOut)) mints.add(step.tokenOut);
      for (const token of step.path) {
        if (!isEngineNativeToken(token)) mints.add(token);
      }
    }
  }
  return [...mints];
}

function deriveAssociatedTokenAddress(
  owner: string,
  mint: string,
  tokenProgram: string,
): string | null {
  try {
    const [address] = PublicKey.findProgramAddressSync(
      [
        new PublicKey(owner).toBuffer(),
        new PublicKey(tokenProgram).toBuffer(),
        new PublicKey(mint).toBuffer(),
      ],
      new PublicKey(ASSOCIATED_TOKEN_PROGRAM),
    );
    return address.toBase58();
  } catch {
    return null;
  }
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
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
