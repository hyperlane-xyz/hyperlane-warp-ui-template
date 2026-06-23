import type { ChainMetadata } from '@hyperlane-xyz/sdk';
import {
  addressToByteHexString,
  base58ToBuffer,
  bufferToBase58,
  bytesToProtocolAddress,
  ensure0x,
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
    if (chainMetadata?.protocol === ProtocolType.Sealevel) {
      return stringToPostgresBytea(base58ToBuffer(txHash).toString('hex'));
    }
    if (
      chainMetadata?.protocol &&
      isBech32mEncodedTxHashProtocol(chainMetadata.protocol) &&
      isValidTransactionHash(txHash, chainMetadata.protocol)
    ) {
      return stringToPostgresBytea(addressToByteHexString(txHash, chainMetadata.protocol));
    }
    if (
      chainMetadata?.protocol &&
      isHexEncodedTxHashProtocol(chainMetadata.protocol) &&
      isValidTransactionHash(txHash, chainMetadata.protocol)
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

export function parseTimestamp(t: string): number {
  const asUtc = t.at(-1) === 'Z' ? t : t + 'Z';
  return new Date(asUtc).getTime();
}
