import type { ChainMetadata } from '@hyperlane-xyz/sdk';
import {
  addressToByteHexString,
  base58ToBuffer,
  bufferToBase58,
  bytesToProtocolAddress,
  ensure0x,
  isAddress,
  isAddressEvm,
  isValidTransactionHashEvm,
  isValidTransactionHashSealevel,
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

export function searchValueToPostgresBytea(input: string): string | undefined {
  if (!input) return undefined;
  try {
    if (isAddress(input)) {
      return addressToPostgresBytea(input);
    }
    if (isValidTransactionHashEvm(input)) {
      return stringToPostgresBytea(input);
    }
    if (isValidTransactionHashSealevel(input)) {
      const bytes = base58ToBuffer(input);
      return stringToPostgresBytea(bytes.toString('hex'));
    }
    return undefined;
  } catch {
    return undefined;
  }
}
