import { Signer, providers } from 'ethers';

import {
  ChainMetadata,
  ChainName,
  HyperlaneDeploymentArtifacts,
  MultiProvider,
  ProtocolType,
} from '@hyperlane-xyz/sdk';

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

  override async tryGetExplorerAddressUrl(
    chainNameOrId: ChainName | number,
    address?: string,
  ): Promise<string | null> {
    const url = await super.tryGetExplorerAddressUrl(chainNameOrId, address);
    // TODO hacking fix for solana explorer url here
    if (this.getChainName(chainNameOrId) === 'solanadevnet') {
      return `${url}?cluster=devnet`;
    }
    return url;
  }

  override tryGetExplorerTxUrl(
    chainNameOrId: ChainName | number,
    response: { hash: string },
  ): string | null {
    const url = super.tryGetExplorerTxUrl(chainNameOrId, response);
    if (!url) return null;

    const chainName = this.getChainName(chainNameOrId);
    // TODO hacking fix for solana explorer url here
    if (chainName === 'solanadevnet') {
      return `${url}?cluster=devnet`;
    } else if (chainName === 'nautilus' || chainName === 'proteustestnet') {
      // TODO hacking fix for nautilus explorer url here
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

export function getProvider(id: Caip2Id) {
  const { reference } = parseCaip2Id(id);
  return getMultiProvider().getProvider(reference);
}
