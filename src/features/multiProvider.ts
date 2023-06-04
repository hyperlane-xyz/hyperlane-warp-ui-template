import { Signer, providers } from 'ethers';

import { ChainName, MultiProvider } from '@hyperlane-xyz/sdk';

import { parseCaip2Id } from './chains/caip2';
import { getChainConfigs } from './chains/metadata';
import { ProtocolType } from './chains/types';

// A ProtocolType-aware MultiProvider
class MultiProtocolMultiProvider extends MultiProvider {
  override tryGetProvider(chainNameOrId: ChainName | number): providers.Provider | null {
    const metadata = this.tryGetChainMetadata(chainNameOrId);
    // @ts-ignore TODO add optional protocol field to ChainMetadata in SDK
    if (metadata?.protocol && metadata?.protocol !== ProtocolType.Ethereum) return null;
    return super.tryGetProvider(chainNameOrId);
  }

  override tryGetSigner(chainNameOrId: ChainName | number): Signer | null {
    const metadata = this.tryGetChainMetadata(chainNameOrId);
    // @ts-ignore TODO add optional protocol field to ChainMetadata in SDK
    if (metadata?.protocol && metadata?.protocol !== ProtocolType.Ethereum) return null;
    return super.tryGetSigner(chainNameOrId);
  }
}

let multiProvider: MultiProvider;

export function getMultiProvider() {
  if (!multiProvider) {
    multiProvider = new MultiProtocolMultiProvider(getChainConfigs());
  }
  return multiProvider;
}

export function getProvider(id: Caip2Id) {
  const { reference } = parseCaip2Id(id);
  return getMultiProvider().getProvider(reference);
}
