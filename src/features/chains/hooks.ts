import { ChainName, ChainStatus } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { useMemo } from 'react';
import { config } from '../../consts/config';
import { useStore } from '../store';
import { getChainDisplayName } from './utils';

export function useMultiProvider() {
  return useStore((s) => s.multiProvider);
}

// Ensures that the multiProvider has been populated during the onRehydrateStorage hook above,
// otherwise returns undefined
export function useReadyMultiProvider() {
  const multiProvider = useMultiProvider();
  if (!multiProvider.getKnownChainNames().length) return undefined;
  return multiProvider;
}

export function useChainMetadata(chainName?: ChainName) {
  const multiProvider = useMultiProvider();
  if (!chainName) return undefined;
  return multiProvider.tryGetChainMetadata(chainName);
}

export function useChainProtocol(chainName?: ChainName) {
  const metadata = useChainMetadata(chainName);
  return metadata?.protocol;
}

export function useChainDisplayName(chainName: ChainName, shortName = false) {
  const multiProvider = useMultiProvider();
  return getChainDisplayName(multiProvider, chainName, shortName);
}

export interface ChainInfo {
  name: string;
  displayName: string;
  chainId: ChainId;
  protocol: ProtocolType;
  isTestnet: boolean;
  disabled: boolean;
}

export function useChainInfos(): ChainInfo[] {
  const chainMetadata = useStore((s) => s.chainMetadata);

  return useMemo(() => {
    const chainInfos = Object.values(chainMetadata).map((chain) => ({
      name: chain.name,
      displayName: chain.displayName || chain.name,
      chainId: chain.chainId,
      protocol: chain.protocol,
      isTestnet: !!chain.isTestnet,
      disabled: config.shouldDisableChains && chain.availability?.status === ChainStatus.Disabled,
    }));
    return chainInfos;
  }, [chainMetadata]);
}
