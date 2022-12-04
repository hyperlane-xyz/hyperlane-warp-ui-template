import { getAddress, isAddress } from '@ethersproject/address';

import { logger } from './logger';

// Validates content and checksum
export function isValidAddress(address: string) {
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
export function isValidAddressFast(address: string) {
  return addressRegex.test(address);
}

export function validateAddress(address: string, context: string) {
  if (!address || !isAddress(address)) {
    const errorMsg = `Invalid addresses for ${context}: ${address}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
}

export function normalizeAddress(address: string) {
  validateAddress(address, 'normalize');
  return getAddress(address);
}

export function shortenAddress(address: string, capitalize?: boolean) {
  try {
    const normalized = normalizeAddress(address);
    const shortened =
      normalized.substring(0, 5) + '...' + normalized.substring(normalized.length - 4);
    return capitalize ? capitalizeAddress(shortened) : shortened;
  } catch (error) {
    logger.error('Unable to shorten invalid address', address, error);
    return null;
  }
}

export function capitalizeAddress(address: string) {
  return '0x' + address.substring(2).toUpperCase();
}

export function areAddressesEqual(a1: string, a2: string) {
  validateAddress(a1, 'compare');
  validateAddress(a2, 'compare');
  return getAddress(a1) === getAddress(a2);
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
