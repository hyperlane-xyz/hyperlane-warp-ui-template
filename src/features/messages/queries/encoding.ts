import type { ChainMetadata } from '@hyperlane-xyz/sdk';
import {
  addressToByteHexString,
  bufferToBase58,
  bytesToProtocolAddress,
  ensure0x,
  isAddressEvm,
  ProtocolType,
  strip0x,
} from '@hyperlane-xyz/utils';

function stringToPostgresBytea(hexString: string): string {
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
  return bytesToProtocolAddress(addressBytes, chainMetadata.protocol, chainMetadata.bech32Prefix);
}

export function postgresByteaToTxHash(
  byteString: string,
  chainMetadata: ChainMetadata | null | undefined,
): string {
  const hexString = postgresByteaToString(byteString);
  if (chainMetadata?.protocol !== ProtocolType.Sealevel) return hexString;
  const bytes = Buffer.from(strip0x(hexString), 'hex');
  return bufferToBase58(bytes);
}
