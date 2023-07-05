import { Signer, providers } from 'ethers';

import { ChainMetadata, ChainName, MultiProvider } from '@hyperlane-xyz/sdk';

import { isNumeric } from '../utils/string';

import { parseCaip2Id } from './chains/caip2';
import { getChainConfigs } from './chains/metadata';
import { CustomChainMetadata, ProtocolType } from './chains/types';

// A ProtocolType-aware MultiProvider
class MultiProtocolProvider extends MultiProvider {
  override tryGetChainMetadata(chainNameOrId: ChainName | number): CustomChainMetadata | null {
    let chainMetadata: ChainMetadata | undefined;
    if (isNumeric(chainNameOrId)) {
      chainMetadata = Object.values(this.metadata).find(
        (m) => m.chainId == chainNameOrId || m.domainId == chainNameOrId,
      );
    } else if (typeof chainNameOrId === 'string') {
      chainMetadata = this.metadata[chainNameOrId];
    }
    return chainMetadata || null;
  }

  override getChainMetadata(chainNameOrId: ChainName | number): CustomChainMetadata {
    return super.getChainMetadata(chainNameOrId) as CustomChainMetadata;
  }

  override tryGetProvider(chainNameOrId: ChainName | number): providers.Provider | null {
    const metadata = this.tryGetChainMetadata(chainNameOrId);
    // @ts-ignore TODO add optional protocol field to ChainMetadata in SDK
    if (metadata?.protocol && metadata.protocol !== ProtocolType.Ethereum) return null;
    return super.tryGetProvider(chainNameOrId);
  }

  override tryGetSigner(chainNameOrId: ChainName | number): Signer | null {
    const metadata = this.tryGetChainMetadata(chainNameOrId);
    // @ts-ignore TODO add optional protocol field to ChainMetadata in SDK
    if (metadata?.protocol && metadata.protocol !== ProtocolType.Ethereum) return null;
    return super.tryGetSigner(chainNameOrId);
  }
}

let multiProvider: MultiProtocolProvider;

export function getMultiProvider() {
  if (!multiProvider) {
    multiProvider = new MultiProtocolProvider(getChainConfigs());
  }
  return multiProvider;
}

export function getProvider(id: Caip2Id) {
  const { reference } = parseCaip2Id(id);
  return getMultiProvider().getProvider(reference);
}
