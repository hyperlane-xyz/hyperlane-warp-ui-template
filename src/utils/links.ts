import { toBase64 } from '@hyperlane-xyz/utils';

import { config } from '../consts/config';
import { links } from '../consts/links';
import { parseCaip2Id } from '../features/caip/chains';
import { isPermissionlessChain } from '../features/chains/utils';
import { getMultiProvider } from '../features/multiProvider';

// TODO test with cosmos chain config, or disallow it
export function getHypExplorerLink(originCaip2Id: ChainCaip2Id, msgId?: string) {
  if (!config.enableExplorerLink || !originCaip2Id || !msgId) return null;
  const baseLink = `${links.explorer}/message/${msgId}`;
  if (isPermissionlessChain(originCaip2Id)) {
    const { reference } = parseCaip2Id(originCaip2Id);
    const chainConfig = getMultiProvider().getChainMetadata(reference);
    const serializedConfig = toBase64([chainConfig]);
    if (serializedConfig) {
      const params = new URLSearchParams({ chains: serializedConfig });
      return `${baseLink}?${params.toString()}`;
    }
  }
  return baseLink;
}
