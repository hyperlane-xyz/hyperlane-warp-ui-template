import { starknetsepolia } from '@hyperlane-xyz/registry';
import { chainMetadataToStarknetChain } from '@hyperlane-xyz/sdk';
import { getStarknetChains } from '@hyperlane-xyz/widgets';
import { Chain } from '@starknet-react/chains';
import { StarknetConfig, publicProvider, voyager } from '@starknet-react/core';
import { PropsWithChildren, useMemo } from 'react';
import { InjectedConnector } from 'starknetkit/injected';
import { useMultiProvider } from '../../chains/hooks';

const initialChain = chainMetadataToStarknetChain(starknetsepolia);

export function StarknetWalletContext({ children }: PropsWithChildren<unknown>) {
  const multiProvider = useMultiProvider();
  const chainsFromRegistry = getStarknetChains(multiProvider);
  const connectors = useMemo(
    () => [
      new InjectedConnector({ options: { id: 'braavos', name: 'Braavos' } }),
      new InjectedConnector({ options: { id: 'argentX', name: 'Argent X' } }),
    ],
    [],
  );

  // Because at least one chain is required, we need an initial chain here,
  // because chains are built based on MultiProvider and existing chains from warp routes
  const uniqueChains = useMemo(() => {
    //
    const combinedChains = [...chainsFromRegistry, initialChain];
    const chainMap = combinedChains.reduce((map, chain) => {
      if (!map.has(chain.id)) {
        map.set(chain.id, chain);
      }
      return map;
    }, new Map<bigint, Chain>());
    return Array.from(chainMap.values());
  }, [chainsFromRegistry]);

  return (
    <StarknetConfig
      chains={uniqueChains}
      provider={publicProvider()}
      connectors={connectors}
      explorer={voyager}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}
