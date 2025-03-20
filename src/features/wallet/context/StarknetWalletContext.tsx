// import { getStarknetChains } from "@hyperlane-xyz/widgets";
import { PropsWithChildren } from 'react';

export function StarknetWalletContext({ children }: PropsWithChildren<unknown>) {
  // const multiProvider = useMultiProvider();
  // const chains = getStarknetChains(multiProvider);
  // const chains = [];
  // const connectors = useMemo(
  //   () => [
  //     new InjectedConnector({ options: { id: 'braavos', name: 'Braavos' } }),
  //     new InjectedConnector({ options: { id: 'argentX', name: 'Argent X' } }),
  //   ],
  //   [],
  // );

  return <>{children}</>;
}
