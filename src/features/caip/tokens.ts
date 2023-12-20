import { ProtocolType, isValidAddress, isZeroishAddress } from '@hyperlane-xyz/utils';

import { COSMOS_ZERO_ADDRESS, EVM_ZERO_ADDRESS, SOL_ZERO_ADDRESS } from '../../consts/values';
import { logger } from '../../utils/logger';

export enum AssetNamespace {
  native = 'native',
  erc20 = 'erc20',
  erc721 = 'erc721',
  spl = 'spl', // Solana Program Library standard token
  spl2022 = 'spl2022', // Updated SPL version
  ibcDenom = 'ibcDenom',
}

// Based mostly on https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-19.md
// But uses simpler asset namespace naming for native tokens
export function getCaip19Id(
  chainCaip2Id: ChainCaip2Id,
  namespace: AssetNamespace,
  address: Address,
  tokenId?: string | number,
): TokenCaip19Id {
  if (!Object.values(AssetNamespace).includes(namespace)) {
    throw new Error(`Invalid asset namespace: ${namespace}`);
  }
  if (!isValidAddress(address) && !isZeroishAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  // NOTE: deviation from CAIP-19 spec here by separating token id with : instead of /
  // Doing this because cosmos addresses use / all over the place
  // The CAIP standard doesn't specify how to handle ibc / token factory addresses
  return `${chainCaip2Id}/${namespace}:${address}${tokenId ? `:${tokenId}` : ''}`;
}

export function parseCaip19Id(id: TokenCaip19Id) {
  const segments = id.split('/');
  if (segments.length < 2)
    throw new Error(`Invalid caip19 id: ${id}. Must have at least 2 main segments`);

  const chainCaip2Id = segments[0] as ChainCaip2Id;
  const rest = segments.slice(1).join('/');
  const tokenSegments = rest.split(':');
  let namespace: AssetNamespace;
  let address: Address;
  let tokenId: string | undefined;
  if (tokenSegments.length == 2) {
    [namespace, address] = tokenSegments as [AssetNamespace, Address];
  } else if (tokenSegments.length == 3) {
    // NOTE: deviation from CAIP-19 spec here by separating token id with : instead of /
    // Doing this because cosmos addresses use / all over the place
    // The CAIP standard doesn't specify how to handle ibc / token factory addresses
    [namespace, address, tokenId] = tokenSegments as [AssetNamespace, Address, string];
  } else {
    throw new Error(`Invalid caip19 id: ${id}. Must have 2 or 3 token segment`);
  }

  if (!chainCaip2Id || !namespace || !address)
    throw new Error(`Invalid caip19 id: ${id}. Segment values missing`);

  return { chainCaip2Id, namespace, address, tokenId };
}

export function tryParseCaip19Id(id?: TokenCaip19Id) {
  if (!id) return undefined;
  try {
    return parseCaip19Id(id);
  } catch (err) {
    logger.error('Error parsing caip2 id', err);
    return undefined;
  }
}

export function getChainIdFromToken(id: TokenCaip19Id): ChainCaip2Id {
  return parseCaip19Id(id).chainCaip2Id;
}

export function tryGetChainIdFromToken(id?: TokenCaip19Id): ChainCaip2Id | undefined {
  return tryParseCaip19Id(id)?.chainCaip2Id;
}

export function getAssetNamespace(id: TokenCaip19Id): AssetNamespace {
  return parseCaip19Id(id).namespace as AssetNamespace;
}

export function getTokenAddress(id: TokenCaip19Id): Address {
  return parseCaip19Id(id).address;
}

export function isNativeToken(id: TokenCaip19Id): boolean {
  const { namespace } = parseCaip19Id(id);
  return namespace === AssetNamespace.native;
}

export function getNativeTokenAddress(protocol: ProtocolType): Address {
  if (protocol === ProtocolType.Ethereum) {
    return EVM_ZERO_ADDRESS;
  } else if (protocol === ProtocolType.Sealevel) {
    return SOL_ZERO_ADDRESS;
  } else if (protocol === ProtocolType.Cosmos) {
    return COSMOS_ZERO_ADDRESS;
  } else {
    throw new Error(`Unsupported protocol: ${protocol}`);
  }
}

export function isNonFungibleToken(id: TokenCaip19Id): boolean {
  const { namespace } = parseCaip19Id(id);
  return namespace === AssetNamespace.erc721;
}

export function resolveAssetNamespace(
  protocol: ProtocolType,
  isNative?: boolean,
  isNft?: boolean,
  isSpl2022?: boolean,
) {
  if (isNative) return AssetNamespace.native;
  switch (protocol) {
    case ProtocolType.Ethereum:
      return isNft ? AssetNamespace.erc721 : AssetNamespace.erc20;
    case ProtocolType.Sealevel:
      return isSpl2022 ? AssetNamespace.spl2022 : AssetNamespace.spl;
    case ProtocolType.Cosmos:
      return AssetNamespace.ibcDenom;
    default:
      throw new Error(`Unsupported protocol: ${protocol}`);
  }
}
