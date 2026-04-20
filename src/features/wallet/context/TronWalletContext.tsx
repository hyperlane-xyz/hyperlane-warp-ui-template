import { WalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapter-tronlink';
import { PropsWithChildren, useMemo } from 'react';

export function TronWalletContext({ children }: PropsWithChildren<unknown>) {
  const adapters = useMemo(() => [new TronLinkAdapter()], []);
  return <WalletProvider adapters={adapters}>{children}</WalletProvider>;
}
