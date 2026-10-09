import { isAbacusWorksChain } from '@hyperlane-xyz/registry';
<<<<<<< HEAD
import {
  ChainMap,
  ChainMetadata,
  ChainStatus,
  MultiProtocolProvider,
  WarpCore,
} from '@hyperlane-xyz/sdk';
import { toTitleCase, trimToLength } from '@hyperlane-xyz/utils';
import { ChainSearchMenuProps } from '@hyperlane-xyz/widgets';
import { config } from '../../consts/config';
=======
import { ChainMetadata, ChainStatus } from '@hyperlane-xyz/sdk';
import { toTitleCase } from '@hyperlane-xyz/utils';

import { config } from '../../consts/config';

type ChainMetadataProvider = Pick<
  import('@hyperlane-xyz/sdk').MultiProtocolProvider,
  'metadata' | 'tryGetChainMetadata' | 'tryGetChainName'
>;
>>>>>>> origin/main

export function getChainDisplayName(
  multiProvider: ChainMetadataProvider,
  chain: ChainName,
  shortName = false,
) {
  if (!chain) return 'Unknown';
  const metadata = multiProvider.tryGetChainMetadata(chain);
  if (!metadata) return 'Unknown';
  const displayName = shortName ? metadata.displayNameShort : metadata.displayName;
  return displayName || metadata.displayName || toTitleCase(metadata.name);
}

export function isPermissionlessChain(multiProvider: ChainMetadataProvider, chain: ChainName) {
  if (!chain) return true;
  const metadata = multiProvider.tryGetChainMetadata(chain);
  return !metadata || !isAbacusWorksChain(metadata);
}

export function hasPermissionlessChain(multiProvider: ChainMetadataProvider, ids: ChainName[]) {
  return !ids.every((c) => !isPermissionlessChain(multiProvider, c));
}

export function isChainDisabled(chainMetadata: ChainMetadata | null) {
  if (!config.shouldDisableChains || !chainMetadata) return false;

  return chainMetadata.availability?.status === ChainStatus.Disabled;
}

export function isChainDisabled(chainMetadata: ChainMetadata | null) {
  if (!config.shouldDisableChains || !chainMetadata) return false;

  return chainMetadata.availability?.status === ChainStatus.Disabled;
}

/**
 * Return given chainName if it is valid, otherwise return undefined
 */
export function tryGetValidChainName(
  chainName: string | null,
  multiProvider: ChainMetadataProvider,
): string | undefined {
  const validChainName = chainName && multiProvider.tryGetChainName(chainName);
  const chainMetadata = validChainName ? multiProvider.tryGetChainMetadata(chainName) : null;
  const chainDisabled = isChainDisabled(chainMetadata);

  if (chainDisabled) return undefined;

  return validChainName ? chainName : undefined;
}
