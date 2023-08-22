import { Signer, providers } from 'ethers';

import {
  ChainMetadata,
  ChainName,
  HyperlaneDeploymentArtifacts,
  MultiProvider,
  ProtocolType,
} from '@hyperlane-xyz/sdk';

import { solanaChainToClusterName } from '../consts/chains';
import { isNumeric } from '../utils/string';

import { parseCaip2Id } from './caip/chains';
import { getChainConfigs } from './chains/metadata';

// A ProtocolType-aware MultiProvider
class MultiProtocolProvider extends MultiProvider {
  override tryGetChainMetadata(chainNameOrId: ChainName | number): ChainMetadata | null {
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

  // Custom chains include deployment artifacts so this gets metadata type with optional contract addresses
  getChainMetadataWithArtifacts(chainNameOrId: ChainName | number) {
    const metadata = super.getChainMetadata(chainNameOrId);
    return metadata as ChainMetadata & Partial<HyperlaneDeploymentArtifacts>;
  }

  override tryGetProvider(chainNameOrId: ChainName | number): providers.Provider | null {
    const metadata = this.tryGetChainMetadata(chainNameOrId);
    if (metadata?.protocol && metadata.protocol !== ProtocolType.Ethereum) return null;
    return super.tryGetProvider(chainNameOrId);
  }

  override tryGetSigner(chainNameOrId: ChainName | number): Signer | null {
    const metadata = this.tryGetChainMetadata(chainNameOrId);
    if (metadata?.protocol && metadata.protocol !== ProtocolType.Ethereum) return null;
    return super.tryGetSigner(chainNameOrId);
  }

  // TODO Add special-case handling to to SDK
  override async tryGetExplorerAddressUrl(
    chainNameOrId: ChainName | number,
    address?: string,
  ): Promise<string | null> {
    const url = await super.tryGetExplorerAddressUrl(chainNameOrId, address);
    if (!url) return null;
    const metadata = this.getChainMetadata(chainNameOrId);
    const chainName = metadata.name;
    if (metadata.protocol === ProtocolType.Sealevel && solanaChainToClusterName[chainName]) {
      return `${url}?cluster=${solanaChainToClusterName[chainName]}`;
    }
    return url;
  }

  // TODO Add special-case handling to to SDK
  override tryGetExplorerTxUrl(
    chainNameOrId: ChainName | number,
    response: { hash: string },
  ): string | null {
    const url = super.tryGetExplorerTxUrl(chainNameOrId, response);
    if (!url) return null;
    const metadata = this.getChainMetadata(chainNameOrId);
    const chainName = metadata.name;
    if (metadata.protocol === ProtocolType.Sealevel && solanaChainToClusterName[chainName]) {
      return `${url}?cluster=${solanaChainToClusterName[chainName]}`;
    } else if (chainName === 'nautilus' || chainName === 'proteustestnet') {
      return url.replaceAll('/tx/', '/transaction/');
    }
    return url;
  }
}

let multiProvider: MultiProtocolProvider;

export function getMultiProvider() {
  if (!multiProvider) {
    multiProvider = new MultiProtocolProvider(getChainConfigs());
  }
  return multiProvider;
}

export function getProvider(id: ChainCaip2Id) {
  const { reference } = parseCaip2Id(id);
  return getMultiProvider().getProvider(reference);
}
