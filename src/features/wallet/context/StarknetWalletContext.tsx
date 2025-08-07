import { starknetsepolia } from '@hyperlane-xyz/registry';
import { chainMetadataToStarknetChain } from '@hyperlane-xyz/sdk';
import { getStarknetChains } from '@hyperlane-xyz/widgets';
import { Chain } from '@starknet-react/chains';
import { StarknetConfig, publicProvider, voyager } from '@starknet-react/core';
import { PropsWithChildren, useMemo } from 'react';
import { InjectedConnector } from 'starknetkit/injected';
import { useMultiProvider } from '../../chains/hooks';

const initialChain = chainMetadataToStarknetChain(starknetsepolia);
const READY_WALLET_ICON = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iYmxhY2siLz4KPHBhdGggZD0iTTE4LjQwMTggNy41NTU1NkgxMy41OTgyQzEzLjQzNzcgNy41NTU1NiAxMy4zMDkxIDcuNjg3NDcgMTMuMzA1NiA3Ljg1MTQzQzEzLjIwODUgMTIuNDYwMyAxMC44NDg0IDE2LjgzNDcgNi43ODYwOCAxOS45MzMxQzYuNjU3MTEgMjAuMDMxNCA2LjYyNzczIDIwLjIxNjIgNi43MjIwMiAyMC4zNDkzTDkuNTMyNTMgMjQuMzE5NkM5LjYyODE1IDI0LjQ1NDggOS44MTQ0NCAyNC40ODUzIDkuOTQ1NTggMjQuMzg2QzEyLjQ4NTYgMjIuNDYxMyAxNC41Mjg3IDIwLjEzOTUgMTYgMTcuNTY2QzE3LjQ3MTMgMjAuMTM5NSAxOS41MTQ1IDIyLjQ2MTMgMjIuMDU0NSAyNC4zODZDMjIuMTg1NiAyNC40ODUzIDIyLjM3MTkgMjQuNDU0OCAyMi40Njc2IDI0LjMxOTZMMjUuMjc4MSAyMC4zNDkzQzI1LjM3MjMgMjAuMjE2MiAyNS4zNDI5IDIwLjAzMTQgMjUuMjE0IDE5LjkzMzFDMjEuMTUxNiAxNi44MzQ3IDE4Ljc5MTUgMTIuNDYwMyAxOC42OTQ2IDcuODUxNDNDMTguNjkxMSA3LjY4NzQ3IDE4LjU2MjMgNy41NTU1NiAxOC40MDE4IDcuNTU1NTZaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjQuNzIzNiAxMC40OTJMMjQuMjIzMSA4LjkyNDM5QzI0LjEyMTMgOC42MDYxNCAyMy44NzM0IDguMzU4MjQgMjMuNTU3NyA4LjI2MDIzTDIyLjAwMzkgNy43NzU5NUMyMS43ODk1IDcuNzA5MDYgMjEuNzg3MyA3LjQwMTc3IDIyLjAwMTEgNy4zMzIwMUwyMy41NDY5IDYuODI0NjZDMjMuODYwOSA2LjcyMTQ2IDI0LjEwNiA2LjQ2OTUyIDI0LjIwMjcgNi4xNTAxMUwyNC42Nzk4IDQuNTc1MDJDMjQuNzQ1OCA0LjM1NzA5IDI1LjA0ODkgNC4zNTQ3NyAyNS4xMTgzIDQuNTcxNTZMMjUuNjE4OCA2LjEzOTE1QzI1LjcyMDYgNi40NTc0IDI1Ljk2ODYgNi43MDUzMSAyNi4yODQyIDYuODAzOUwyNy44MzggNy4yODc2MUMyOC4wNTI0IDcuMzU0NSAyOC4wNTQ3IDcuNjYxNzkgMjcuODQwOCA3LjczMjEzTDI2LjI5NSA4LjIzOTQ4QzI1Ljk4MTEgOC4zNDIxIDI1LjczNiA4LjU5NDA0IDI1LjYzOTMgOC45MTQwMkwyNS4xNjIxIDEwLjQ4ODVDMjUuMDk2MSAxMC43MDY1IDI0Ljc5MyAxMC43MDg4IDI0LjcyMzYgMTAuNDkyWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==`;

export function StarknetWalletContext({ children }: PropsWithChildren<unknown>) {
  const multiProvider = useMultiProvider();
  const chainsFromRegistry = getStarknetChains(multiProvider);
  const connectors = useMemo(
    () => [
      new InjectedConnector({ options: { id: 'braavos', name: 'Braavos' } }),
      new InjectedConnector({
        options: { id: 'argentX', name: 'Ready Wallet (formerly Argent)', icon: READY_WALLET_ICON },
      }),
      new InjectedConnector({ options: { id: 'keplr', name: 'Keplr' } }),
      new InjectedConnector({ options: { id: 'metamask', name: 'MetaMask Snap' } }),
      new InjectedConnector({ options: { id: 'okxwallet', name: 'OKX' } }),
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
