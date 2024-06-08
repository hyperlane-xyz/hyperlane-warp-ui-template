import { toBase64 } from '@hyperlane-xyz/utils';

import { config } from '../consts/config';
import { links } from '../consts/links';
import { getChainMetadata, isPermissionlessChain } from '../features/chains/utils';

// TODO test with cosmos chain config, or disallow it
export function getHypExplorerLink(chain: ChainName, msgId?: string) {
  if (!config.enableExplorerLink || !chain || !msgId) return null;
  const baseLink = `${links.explorer}/message/${msgId}`;
  if (isPermissionlessChain(chain)) {
    const chainMetadata = getChainMetadata(chain);
    const serializedConfig = toBase64([chainMetadata]);
    if (serializedConfig) {
      const params = new URLSearchParams({ chains: serializedConfig });
      return `${baseLink}?${params.toString()}`;
    }
  }
  return baseLink;
}
