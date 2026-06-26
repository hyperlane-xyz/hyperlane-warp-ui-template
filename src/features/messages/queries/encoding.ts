import type { ChainMetadata } from '@hyperlane-xyz/sdk';
import {
  addressToByteHexString,
  base58ToBuffer,
  bufferToBase58,
  bytesToProtocolAddress,
  ensure0x,
  hexToBech32mPrefix,
  hexToRadixCustomPrefix,
  isAddressEvm,
  isValidTransactionHash,
  ProtocolType,
  strip0x,
} from '@hyperlane-xyz/utils';

export function stringToPostgresBytea(hexString: string): string {
  const trimmed = strip0x(hexString).toLowerCase();
  return `\\x${trimmed}`;
}

export function postgresByteaToString(byteString: string): string {
  if (!byteString || byteString.length < 4) throw new Error('Invalid byte string');
  return ensure0x(byteString.substring(2));
}

export function addressToPostgresBytea(address: string): string {
  const hexString = isAddressEvm(address) ? address : addressToByteHexString(address);
  return stringToPostgresBytea(hexString);
}

export function txHashToPostgresBytea(
  txHash: string,
  chainMetadata: ChainMetadata | null | undefined,
): string | undefined {
  try {
    const protocol = chainMetadata?.protocol;
    if (protocol === ProtocolType.Sealevel) {
      return stringToPostgresBytea(base58ToBuffer(txHash).toString('hex'));
    }
    if (
      protocol &&
      isBech32mEncodedTxHashProtocol(protocol) &&
      isValidTransactionHash(txHash, protocol)
    ) {
      return stringToPostgresBytea(addressToByteHexString(txHash, protocol));
    }
    if (
      protocol &&
      isHexEncodedTxHashProtocol(protocol) &&
      isValidTransactionHash(txHash, protocol)
    ) {
      return stringToPostgresBytea(txHash);
    }
    if (/^(0x)?[0-9a-fA-F]+$/.test(txHash)) return stringToPostgresBytea(txHash);
    return undefined;
  } catch {
    return undefined;
  }
}

function isBech32mEncodedTxHashProtocol(protocol: ProtocolType) {
  return [ProtocolType.Aleo, ProtocolType.Radix].includes(protocol);
}

function isHexEncodedTxHashProtocol(protocol: ProtocolType) {
  return [
    ProtocolType.Ethereum,
    ProtocolType.Cosmos,
    ProtocolType.CosmosNative,
    ProtocolType.Starknet,
    ProtocolType.Tron,
  ].includes(protocol);
}

export function postgresByteaToAddress(
  byteString: string,
  chainMetadata: ChainMetadata | null | undefined,
): string {
  const hexString = postgresByteaToString(byteString);
  if (!chainMetadata) return hexString;
  const addressBytes = Buffer.from(strip0x(hexString), 'hex');
  if (!addressBytes.length || addressBytes.every((b) => b === 0)) return hexString;
  return bytesToProtocolAddress(addressBytes, chainMetadata.protocol, chainMetadata.bech32Prefix);
}

export function postgresByteaToTxHash(
  byteString: string,
  chainMetadata: ChainMetadata | null | undefined,
): string {
  const hexString = postgresByteaToString(byteString);
  switch (chainMetadata?.protocol) {
    case ProtocolType.Sealevel: {
      const bytes = Buffer.from(strip0x(hexString), 'hex');
      return bufferToBase58(bytes);
    }
    case ProtocolType.Radix:
      return hexToRadixCustomPrefix(hexString, 'txid', chainMetadata.bech32Prefix);
    case ProtocolType.Cosmos:
    case ProtocolType.CosmosNative:
    case ProtocolType.Tron:
      return strip0x(hexString);
    case ProtocolType.Aleo:
      return hexToBech32mPrefix(hexString, 'at');
    default:
      return hexString;
  }
}

export function parseTimestamp(t: string): number {
  const asUtc = t.at(-1) === 'Z' ? t : t + 'Z';
  return new Date(asUtc).getTime();
}
