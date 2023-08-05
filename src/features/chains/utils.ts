import { ProtocolType, chainIdToMetadata } from '@hyperlane-xyz/sdk';

import { toTitleCase } from '../../utils/string';
import { parseCaip2Id } from '../caip/chains';
import { getMultiProvider } from '../multiProvider';

export function getChainDisplayName(id: Caip2Id, shortName = false) {
  if (!id) return 'Unknown';
  const { reference } = parseCaip2Id(id);
  const metadata = getMultiProvider().tryGetChainMetadata(reference || 0);
  if (!metadata) return 'Unknown';
  const displayName = shortName ? metadata.displayNameShort : metadata.displayName;
  return toTitleCase(displayName || metadata.displayName || metadata.name);
}

export function isPermissionlessChain(id: Caip2Id) {
  if (!id) return true;
  const { protocol, reference } = parseCaip2Id(id);
  return protocol !== ProtocolType.Ethereum || !chainIdToMetadata[reference];
}

export function hasPermissionlessChain(ids: Caip2Id[]) {
  return !ids.every((c) => !isPermissionlessChain(c));
}

export function getChainByRpcEndpoint(endpoint?: string) {
  if (!endpoint) return undefined;
  const allMetadata = Object.values(getMultiProvider().metadata);
  return allMetadata.find(
    (m) => !!m.rpcUrls.find((rpc) => rpc.http.toLowerCase().includes(endpoint.toLowerCase())),
  );
}
