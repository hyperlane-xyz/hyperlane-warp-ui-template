import { ProtocolType } from '@hyperlane-xyz/utils';
import { useMemo } from 'react';

import { useChains } from '../../api/hooks';
import type { ChainDiscovery } from '../../api/types';
import { useMultiProvider } from '../../chains/hooks';
import type { ChainInfo } from '../../chains/hooks';

// Engine-driven chain list for the swap modal. /v1/chains is the source
// of truth for what the swap form can quote against. Fall back to
// multiProvider metadata for display name + protocol when engine entries
// are missing those fields.
export function useSwapChainInfos(): ChainInfo[] {
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
