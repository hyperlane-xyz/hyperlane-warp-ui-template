import { ethers } from 'ethers';

import { ProtocolType } from '@hyperlane-xyz/sdk';

import { SOL_ZERO_ADDRESS } from '../../consts/values';
import { isValidAddress } from '../../utils/addresses';
import { logger } from '../../utils/logger';

export enum AssetNamespace {
  native = 'native',
  erc20 = 'erc20',
  erc721 = 'erc721',
  spl = 'spl', // Solana Program Library standard token
  spl2022 = 'spl2022', // Updated SPL version
}

// Based mostly on https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-19.md
// But uses simpler asset namespace naming for native tokens
export function getCaip19Id(
  caip2Id: Caip2Id,
  namespace: AssetNamespace,
  address: Address,
  tokenId?: string | number,
): Caip19Id {
  if (!Object.values(AssetNamespace).includes(namespace)) {
    throw new Error(`Invalid asset namespace: ${namespace}`);
  }
  if (!isValidAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return `${caip2Id}/${namespace}:${address}${tokenId ? `/${tokenId}` : ''}`;
}

export function parseCaip19Id(id: Caip19Id) {
  const segments = id.split('/');
  if (segments.length >= 2) {
    const caip2Id = segments[0] as Caip2Id;
    const [namespace, address] = segments[1].split(':') as [AssetNamespace, Address];
    if (!caip2Id || !namespace || !address) {
      throw new Error(`Invalid caip19 id: ${id}`);
    }
    const tokenId = segments.length > 2 ? segments[2] : undefined;
    return { caip2Id, namespace, address, tokenId };
  } else {
    throw new Error(`Invalid caip19 id: ${id}`);
  }
}

export function tryParseCaip19Id(id: Caip19Id) {
  if (!id) return undefined;
  try {
    return parseCaip19Id(id);
  } catch (err) {
    logger.error('Error parsing caip2 id', err);
    return undefined;
  }
}

export function getCaip2FromToken(id: Caip19Id): Caip2Id {
  return parseCaip19Id(id).caip2Id;
}

export function tryGetCaip2FromToken(id: Caip19Id): Caip2Id | undefined {
  return tryParseCaip19Id(id)?.caip2Id;
}

export function getAssetNamespace(id: Caip19Id): AssetNamespace {
  return parseCaip19Id(id).namespace as AssetNamespace;
}

export function getTokenAddress(id: Caip19Id): Address {
  return parseCaip19Id(id).address;
}

export function isNativeToken(id: Caip19Id): boolean {
  const { namespace } = parseCaip19Id(id);
  return namespace === AssetNamespace.native;
}

export function getNativeTokenAddress(protocol: ProtocolType): Address {
  if (protocol === ProtocolType.Ethereum) {
    return ethers.constants.AddressZero;
  } else if (protocol === ProtocolType.Sealevel) {
    return SOL_ZERO_ADDRESS;
  } else {
    throw new Error(`Unsupported protocol: ${protocol}`);
  }
}

export function isNonFungibleToken(id: Caip19Id): boolean {
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
  if (protocol === ProtocolType.Ethereum) {
    return isNft ? AssetNamespace.erc721 : AssetNamespace.erc20;
  } else if (protocol === ProtocolType.Sealevel) {
    return isSpl2022 ? AssetNamespace.spl2022 : AssetNamespace.spl;
  } else {
    throw new Error(`Unsupported protocol: ${protocol}`);
  }
}
