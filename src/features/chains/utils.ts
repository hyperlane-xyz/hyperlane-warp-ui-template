import { ChainNameOrId } from '@hyperlane-xyz/sdk';
import { ProtocolType, toTitleCase } from '@hyperlane-xyz/utils';

import { getMultiProvider } from '../../context/context';

const ABACUS_WORKS_DEPLOYER_NAME = 'abacus works';

export function getChainDisplayName(chain: ChainName, shortName = false) {
  if (!chain) return 'Unknown';
  const metadata = tryGetChainMetadata(chain);
  if (!metadata) return 'Unknown';
  const displayName = shortName ? metadata.displayNameShort : metadata.displayName;
  return displayName || metadata.displayName || toTitleCase(metadata.name);
}

export function isPermissionlessChain(chain: ChainName) {
  if (!chain) return true;
  const metadata = tryGetChainMetadata(chain);
  return (
    metadata?.protocol !== ProtocolType.Ethereum ||
    metadata.deployer?.name.trim().toLowerCase() !== ABACUS_WORKS_DEPLOYER_NAME
  );
}

export function hasPermissionlessChain(ids: ChainName[]) {
  return !ids.every((c) => !isPermissionlessChain(c));
}

export function getChainByRpcUrl(url?: string) {
  if (!url) return undefined;
  const allMetadata = Object.values(getMultiProvider().metadata);
  return allMetadata.find(
    (m) => !!m.rpcUrls.find((rpc) => rpc.http.toLowerCase().includes(url.toLowerCase())),
  );
}

export function tryGetChainMetadata(chain: ChainNameOrId) {
  return getMultiProvider().tryGetChainMetadata(chain);
}

export function getChainMetadata(chain: ChainNameOrId) {
  return getMultiProvider().getChainMetadata(chain);
}

export function tryGetChainProtocol(chain: ChainNameOrId) {
  return tryGetChainMetadata(chain)?.protocol;
}

export function getChainProtocol(chain: ChainNameOrId) {
  return getChainMetadata(chain).protocol;
}
