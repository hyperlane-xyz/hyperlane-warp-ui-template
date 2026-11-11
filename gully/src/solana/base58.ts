// Base58 (Bitcoin alphabet, as Solana uses it) without dependencies, so the EVM side can turn a Solana address into the
// bytes32 Hyperlane recipient without loading any Solana library.
import { bytesToHex, type Hex } from 'viem';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const MAP: Record<string, number> = Object.fromEntries([...ALPHABET].map((c, i) => [c, i]));

export function base58Decode(s: string): Uint8Array {
  let zeros = 0;
  while (zeros < s.length && s[zeros] === '1') zeros++;
  const le: number[] = []; // little-endian base-256 digits
  for (const ch of s) {
    let carry = MAP[ch];
    if (carry === undefined) throw new Error('Not a base58 string');
    for (let i = 0; i < le.length; i++) {
      carry += le[i] * 58;
      le[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) {
      le.push(carry & 0xff);
      carry >>= 8;
    }
  }
  return new Uint8Array([...new Array<number>(zeros).fill(0), ...le.reverse()]);
}

export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = []; // little-endian base-58 digits
  for (const b of bytes) {
    let carry = b;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  return '1'.repeat(zeros) + digits.reverse().map((d) => ALPHABET[d]).join('');
}

/** A Solana public key (32 bytes) or undefined when `s` is not one. */
export function solanaPubkeyBytes(s: string): Uint8Array | undefined {
  try {
    const b = base58Decode(s.trim());
    return b.length === 32 ? b : undefined;
  } catch {
    return undefined;
  }
}

export function isSolanaAddress(s: string) {
  return solanaPubkeyBytes(s) !== undefined;
}

/** Hyperlane recipient for a Solana destination: the pubkey's 32 bytes as bytes32. */
export function solanaRecipientBytes32(s: string): Hex {
  const b = solanaPubkeyBytes(s);
  if (!b) throw new Error('Enter a valid Solana address');
  return bytesToHex(b);
}
