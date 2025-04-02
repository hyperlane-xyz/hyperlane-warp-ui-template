import { getStarknetChains } from "@hyperlane-xyz/widgets";
import {
  StarknetConfig,
  publicProvider,
  voyager
} from "@starknet-react/core";
import { PropsWithChildren, useMemo } from 'react';
import { InjectedConnector } from "starknetkit/injected";
import { useMultiProvider } from "../../chains/hooks";

export function StarknetWalletContext({ children }: PropsWithChildren<unknown>) {
  const multiProvider = useMultiProvider();
  const chains = getStarknetChains(multiProvider);
  const connectors = useMemo(() => [
    new InjectedConnector({ options: { id: "braavos", name: "Braavos" }}),
    new InjectedConnector({ options: { id: "argentX", name: "Argent X" }}),
  ], [])

   return (
    <StarknetConfig
      chains={chains}
      provider={publicProvider()}
      connectors={connectors}
      explorer={voyager}
    >
      {children}
    </StarknetConfig>
  );
}