import { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { toBase64 } from '@hyperlane-xyz/utils';
import { config } from '../consts/config';
import { links } from '../consts/links';
import { isPermissionlessChain } from '../features/chains/utils';

function withExplorerChainQuery(
  multiProvider: MultiProtocolProvider,
  chain: ChainName,
  baseLink: string,
) {
  if (!isPermissionlessChain(multiProvider, chain)) return baseLink;

  const chainMetadata = multiProvider.tryGetChainMetadata(chain);
  if (!chainMetadata) return baseLink;

  const serializedConfig = toBase64([chainMetadata]);
  if (!serializedConfig) return baseLink;

  const params = new URLSearchParams({ chains: serializedConfig });
  return `${baseLink}?${params.toString()}`;
}

export function getHypExplorerSearchLink(query?: string) {
  if (!config.enableExplorerLink || !query) return null;
  const params = new URLSearchParams({ search: query });
  return `${links.explorer}/?${params.toString()}`;
}

export function getHypExplorerLink(
  multiProvider: MultiProtocolProvider,
  chain: ChainName | undefined,
  msgId?: string,
) {
  if (!config.enableExplorerLink || !msgId) return null;
  if (!chain) return getHypExplorerSearchLink(msgId);
  const baseLink = `${links.explorer}/message/${msgId}`;
  return withExplorerChainQuery(multiProvider, chain, baseLink);
}

export function getHypExplorerTxLink(
  multiProvider: MultiProtocolProvider,
  chain: ChainName | undefined,
  txHash?: string,
) {
  if (!config.enableExplorerLink || !txHash) return null;
  if (!chain) return getHypExplorerSearchLink(txHash);
  const baseLink = `${links.explorer}/tx/${txHash}`;
  return withExplorerChainQuery(multiProvider, chain, baseLink);
}
