import { ChainName, ChainStatus } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { useMemo } from 'react';

import { config } from '../../consts/config';
import { useChains } from '../api/hooks';
import type { ChainDiscovery } from '../api/types';
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

export function useDisabledChains(): Set<string> {
  const chainInfos = useChainInfos();
  return useMemo(
    () => new Set(chainInfos.filter((c) => c.disabled).map((c) => c.name)),
    [chainInfos],
  );
}

// Engine-driven chain list for the transfer modal. /v1/chains is the source
// of truth for what the transfer form can quote against. Fall back to
// multiProvider metadata for display name + protocol when engine entries
// are missing those fields.
export function useTransferChainInfos(): ChainInfo[] {
  const { data } = useChains();
  const mp = useMultiProvider();
  return useMemo(() => {
    const chains: ChainInfo[] = [];
    for (const c of (data?.chains ?? []) as ChainDiscovery[]) {
      const meta = mp.tryGetChainMetadata(c.chainName);
      chains.push({
        name: c.chainName,
        displayName: c.displayName || meta?.displayName || c.chainName,
        chainId: c.id,
        protocol: (meta?.protocol ?? mapProtocol(c.protocol)) as ProtocolType,
        isTestnet: !!meta?.isTestnet,
        disabled: false,
      });
    }
    return chains;
  }, [data, mp]);
}

function mapProtocol(p: string): ProtocolType {
  switch (p.toLowerCase()) {
    case 'ethereum':
      return ProtocolType.Ethereum;
    case 'sealevel':
      return ProtocolType.Sealevel;
    case 'cosmos':
      return ProtocolType.Cosmos;
    case 'starknet':
      return ProtocolType.Starknet;
    case 'radix':
      return ProtocolType.Radix;
    case 'tron':
      return ProtocolType.Tron;
    case 'aleo':
      return ProtocolType.Aleo;
    default:
      return ProtocolType.Ethereum;
  }
}
