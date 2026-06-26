import type { ChainMetadata } from '@hyperlane-xyz/sdk';
import {
  addressToByteHexString,
  bufferToBase58,
  bytesToProtocolAddress,
  ensure0x,
  hexToBech32mPrefix,
  hexToRadixCustomPrefix,
  isAddressEvm,
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
