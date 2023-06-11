import { getAddress, isAddress } from '@ethersproject/address';
import { PublicKey } from '@solana/web3.js';

import { logger } from './logger';

// Validates content and checksum
export function isValidEvmAddress(address: string) {
  // Need to catch because ethers' isAddress throws in some cases (bad checksum)
  try {
    const isValid = address && isAddress(address);
    return !!isValid;
  } catch (error) {
    logger.warn('Invalid address', error, address);
    return false;
  }
}

// Faster then above and avoids exceptions but less thorough
const addressRegex = /^0x[a-fA-F0-9]{40}$/;
export function isValidEvmAddressFast(address: string) {
  return addressRegex.test(address);
}

export function validateEvmAddress(address: string, context: string) {
  if (!address || !isAddress(address)) {
    const errorMsg = `Invalid evm address for ${context}: ${address}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
}

export function normalizeEvmAddress(address: string) {
  try {
    return getAddress(address);
  } catch (error) {
    logger.error('Error normalizing evm address', address, error);
    return address;
  }
}

export function normalizeSolAddress(address: string) {
  try {
    return new PublicKey(address).toBase58();
  } catch (error) {
    logger.error('Error normalizing sol address', address, error);
    return address;
  }
}

export function shortenAddress(address: string, capitalize?: boolean) {
  if (!address) return '';
  if (address.length < 8) return address;
  let normalized;
  if (isValidEvmAddressFast(address)) {
    normalized = normalizeEvmAddress(address);
  } else {
    normalized = normalizeSolAddress(address);
  }

  const shortened =
    normalized.substring(0, 5) + '...' + normalized.substring(normalized.length - 4);
  return capitalize ? capitalizeAddress(shortened) : shortened;
}

export function capitalizeAddress(address: string) {
  if (address.startsWith('0x')) return '0x' + address.substring(2).toUpperCase();
  else return address.toUpperCase();
}

// TODO solana
export function areAddressesEqual(a1: string, a2: string) {
  validateEvmAddress(a1, 'compare');
  validateEvmAddress(a2, 'compare');
  return getAddress(a1) === getAddress(a2);
}

const zeroishRegex = /^(0x)?0*$/;
export function isZeroishAddress(address: string) {
  return zeroishRegex.test(address);
}

export function trimLeading0x(input: string) {
  return input.startsWith('0x') ? input.substring(2) : input;
}

export function ensureLeading0x(input: string) {
  return input.startsWith('0x') ? input : `0x${input}`;
}

const txHashRegex = /^0x([A-Fa-f0-9]{64})$/;
export function isValidTransactionHash(input: string) {
  return txHashRegex.test(input);
}
