import { chainIdToMetadata } from '@hyperlane-xyz/sdk';

import { toTitleCase } from '../../utils/string';
import { getMultiProvider } from '../multiProvider';

import { parseCaip2Id } from './caip2';

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
  const { reference } = parseCaip2Id(id);
  return !chainIdToMetadata[reference];
}

export function hasPermissionlessChain(ids: Caip2Id[]) {
  return !ids.every((c) => !isPermissionlessChain(c));
}
