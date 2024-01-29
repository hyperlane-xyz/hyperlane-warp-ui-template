import { chainIdToMetadata } from '@hyperlane-xyz/sdk';
import { ProtocolType, toTitleCase } from '@hyperlane-xyz/utils';

import { parseCaip2Id } from '../caip/chains';
import { getMultiProvider } from '../multiProvider';

export function getChainDisplayName(id: ChainCaip2Id, shortName = false) {
  if (!id) return 'Unknown';
  const { reference } = parseCaip2Id(id);
  const metadata = getMultiProvider().tryGetChainMetadata(reference || 0);
  if (!metadata) return 'Unknown';
  const displayName = shortName ? metadata.displayNameShort : metadata.displayName;
  return displayName || metadata.displayName || toTitleCase(metadata.name);
}

export function isPermissionlessChain(id: ChainCaip2Id) {
  if (!id) return true;
  const { protocol, reference } = parseCaip2Id(id);
  return protocol !== ProtocolType.Ethereum || !chainIdToMetadata[reference];
}

export function hasPermissionlessChain(ids: ChainCaip2Id[]) {
  return !ids.every((c) => !isPermissionlessChain(c));
}

export function getChainByRpcEndpoint(endpoint?: string) {
  if (!endpoint) return undefined;
  const allMetadata = Object.values(getMultiProvider().metadata);
  return allMetadata.find(
    (m) => !!m.rpcUrls.find((rpc) => rpc.http.toLowerCase().includes(endpoint.toLowerCase())),
  );
}
