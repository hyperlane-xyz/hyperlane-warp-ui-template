import { links } from '../consts/links';
import { parseCaip2Id } from '../features/caip/chains';
import { isPermissionlessChain } from '../features/chains/utils';
import { getMultiProvider } from '../features/multiProvider';

import { toBase64 } from './base64';

// TODO test with solana chain config, or disallow it
export function getHypExplorerLink(originCaip2Id: Caip2Id, msgId?: string) {
  if (!originCaip2Id || !msgId) return null;
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
