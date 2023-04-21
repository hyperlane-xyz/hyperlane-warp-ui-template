import { chainIdToMetadata } from '@hyperlane-xyz/sdk';

import { toTitleCase } from '../../utils/string';
import { getMultiProvider } from '../multiProvider';

export function getChainDisplayName(chainId?: ChainId, shortName = false) {
  const metadata = getMultiProvider().tryGetChainMetadata(chainId || 0);
  if (!metadata) return 'Unknown';
  const displayName = shortName ? metadata.displayNameShort : metadata.displayName;
  return toTitleCase(displayName || metadata.displayName || metadata.name);
}

export function isPermissionlessChain(chainId: ChainId) {
  return !chainIdToMetadata[chainId];
}

export function hasPermissionlessChain(chainIds: ChainId[]) {
  return !chainIds.every((c) => !isPermissionlessChain(c));
}
