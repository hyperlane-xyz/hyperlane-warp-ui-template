import { isAbacusWorksChain } from '@hyperlane-xyz/registry';
import { ChainMap, ChainMetadata, MultiProtocolProvider, WarpCore } from '@hyperlane-xyz/sdk';
import { ProtocolType, toTitleCase } from '@hyperlane-xyz/utils';

export function getChainDisplayName(
  multiProvider: MultiProtocolProvider,
  chain: ChainName,
  shortName = false,
) {
  if (!chain) return 'Unknown';
  const metadata = multiProvider.tryGetChainMetadata(chain);
  if (!metadata) return 'Unknown';
  const displayName = shortName ? metadata.displayNameShort : metadata.displayName;
  return displayName || metadata.displayName || toTitleCase(metadata.name);
}

export function isPermissionlessChain(multiProvider: MultiProtocolProvider, chain: ChainName) {
  if (!chain) return true;
  const metadata = multiProvider.tryGetChainMetadata(chain);
  return metadata?.protocol !== ProtocolType.Ethereum || !isAbacusWorksChain(metadata);
}

export function hasPermissionlessChain(multiProvider: MultiProtocolProvider, ids: ChainName[]) {
  return !ids.every((c) => !isPermissionlessChain(multiProvider, c));
}

export function getChainByRpcUrl(multiProvider: MultiProtocolProvider, url?: string) {
  if (!url) return undefined;
  const allMetadata = Object.values(multiProvider.metadata);
  return allMetadata.find(
    (m) => !!m.rpcUrls.find((rpc) => rpc.http.toLowerCase().includes(url.toLowerCase())),
  );
}

/**
 * Return a customListItemField object that contains the amount of
 * routes from a single chain to every other chain
 */
export function getCustomListItemField(
  warpCore: WarpCore,
  origin: ChainName,
  chains: ChainMap<ChainMetadata>,
): ChainMap<{ display: string; sortValue: number }> {
  return Object.keys(chains).reduce<ChainMap<{ display: string; sortValue: number }>>(
    (obj, chainName) => {
      const tokens = warpCore.getTokensForRoute(origin, chainName);
      obj[chainName] = {
        display: `${tokens.length} routes`,
        sortValue: tokens.length,
      };

      return obj;
    },
    {},
  );
}
