import { getAddress, isAddress } from '@ethersproject/address';
import { PublicKey } from '@solana/web3.js';

import { ProtocolType } from '@hyperlane-xyz/sdk';
import { utils } from '@hyperlane-xyz/utils';

import { SOL_ZERO_ADDRESS } from '../consts/values';

import { logger } from './logger';

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const SEALEVEL_ADDRESS_REGEX = /^[a-zA-Z0-9]{36,44}$/;

const EVM_TX_HASH_REGEX = /^0x([A-Fa-f0-9]{64})$/;
const SEALEVEL_TX_HASH_REGEX = /^[a-zA-Z1-9]{88}$/;

const ZEROISH_ADDRESS_REGEX = /^(0x)?0*$/;

export function isEvmAddress(address: string) {
  return EVM_ADDRESS_REGEX.test(address);
}

export function isSealevelAddress(address: string) {
  return SEALEVEL_ADDRESS_REGEX.test(address);
}

export function getAddressProtocolType(address: string) {
  if (!address) return undefined;
  if (isEvmAddress(address)) {
    return ProtocolType.Ethereum;
  } else if (isSealevelAddress(address)) {
    return ProtocolType.Sealevel;
  } else {
    logger.error('Invalid address', address);
    return undefined;
  }
}

function routeAddressUtil<T>(
  evmFn: (param: string) => T,
  solFn: (param: string) => T,
  fallback: T,
  param: string,
  protocol?: ProtocolType,
) {
  protocol = protocol || getAddressProtocolType(param);
  if (protocol === ProtocolType.Ethereum) {
    return evmFn(param);
  } else if (protocol === ProtocolType.Sealevel) {
    return solFn(param);
  } else {
    return fallback;
  }
}

// Slower than isEvmAddress above but actually validates content and checksum
export function isValidEvmAddress(address: string) {
  // Need to catch because ethers' isAddress throws in some cases (bad checksum)
  try {
    const isValid = address && isAddress(address);
    return !!isValid;
  } catch (error) {
    logger.warn('Invalid Evm address', error, address);
    return false;
  }
}

// Slower than isSealevelAddress above but actually validates content and checksum
export function isValidSealevelAddress(address: string) {
  try {
    const isValid = address && (address === SOL_ZERO_ADDRESS || new PublicKey(address));
    return !!isValid;
  } catch (error) {
    logger.warn('Invalid Sealevel address', error, address);
    return false;
  }
}

export function isValidAddress(address: string, protocol?: ProtocolType) {
  return routeAddressUtil(isValidEvmAddress, isValidSealevelAddress, false, address, protocol);
}

export function normalizeEvmAddress(address: string) {
  if (isZeroishAddress(address)) return address;
  try {
    return getAddress(address);
  } catch (error) {
    logger.error('Error normalizing evm address', address, error);
    return address;
  }
}

export function normalizeSolAddress(address: string) {
  if (isZeroishAddress(address)) return address;
  try {
    return new PublicKey(address).toBase58();
  } catch (error) {
    logger.error('Error normalizing sol address', address, error);
    return address;
  }
}

export function normalizeAddress(address: string, protocol?: ProtocolType) {
  return routeAddressUtil(normalizeEvmAddress, normalizeSolAddress, address, address, protocol);
}

export function areEvmAddressesEqual(a1: string, a2: string) {
  return normalizeEvmAddress(a1) === normalizeEvmAddress(a2);
}

export function areSolAddressesEqual(a1: string, a2: string) {
  return normalizeSolAddress(a1) === normalizeSolAddress(a2);
}

export function areAddressesEqual(a1: string, a2: string) {
  const p1 = getAddressProtocolType(a1);
  const p2 = getAddressProtocolType(a2);
  if (p1 !== p2) return false;
  return routeAddressUtil(
    (_a1) => areEvmAddressesEqual(_a1, a2),
    (_a1) => areSolAddressesEqual(_a1, a2),
    false,
    a1,
    p1,
  );
}

export function isValidEvmTransactionHash(input: string) {
  return EVM_TX_HASH_REGEX.test(input);
}

export function isValidSolTransactionHash(input: string) {
  return SEALEVEL_TX_HASH_REGEX.test(input);
}

export function isValidTransactionHash(input: string, protocol?: ProtocolType) {
  return routeAddressUtil(
    isValidEvmTransactionHash,
    isValidSolTransactionHash,
    false,
    input,
    protocol,
  );
}

export function isZeroishAddress(address: string) {
  return ZEROISH_ADDRESS_REGEX.test(address);
}

export function shortenAddress(address: string, capitalize?: boolean) {
  if (!address) return '';
  if (address.length < 8) return address;
  const normalized = normalizeAddress(address);
  const shortened =
    normalized.substring(0, 5) + '...' + normalized.substring(normalized.length - 4);
  return capitalize ? capitalizeAddress(shortened) : shortened;
}

export function capitalizeAddress(address: string) {
  if (address.startsWith('0x')) return '0x' + address.substring(2).toUpperCase();
  else return address.toUpperCase();
}

export function EvmAdressToBytes(address: string): Uint8Array {
  const addrBytes32 = utils.addressToBytes32(address);
  return Buffer.from(addrBytes32.substring(2), 'hex');
}

export function SolAddressToBytes(address: string): Uint8Array {
  return new PublicKey(address).toBytes();
}

export function addressToBytes(address: string, protocol?: ProtocolType) {
  return routeAddressUtil(EvmAdressToBytes, SolAddressToBytes, new Uint8Array(), address, protocol);
}

export function addressToByteHexString(address: string, protocol?: ProtocolType) {
  return '0x' + Buffer.from(addressToBytes(address, protocol)).toString('hex');
}

export function convertToProtocolAddress(address: string, protocol: ProtocolType) {
  const currentProtocol = getAddressProtocolType(address);
  if (currentProtocol === protocol) return address;
  if (currentProtocol === ProtocolType.Ethereum && protocol === ProtocolType.Sealevel) {
    return new PublicKey(addressToBytes(address, ProtocolType.Ethereum)).toBase58();
  } else if (currentProtocol === ProtocolType.Sealevel && protocol === ProtocolType.Ethereum) {
    return utils.bytes32ToAddress(
      Buffer.from(addressToBytes(address, ProtocolType.Sealevel)).toString('hex'),
    );
  } else {
    throw new Error(`Unsupported protocol combination ${currentProtocol} -> ${protocol}`);
  }
}

export function trimLeading0x(input: string) {
  return input.startsWith('0x') ? input.substring(2) : input;
}

export function ensureLeading0x(input: string) {
  return input.startsWith('0x') ? input : `0x${input}`;
}
