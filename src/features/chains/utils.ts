import { isAbacusWorksChain } from '@hyperlane-xyz/registry';
import { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
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
