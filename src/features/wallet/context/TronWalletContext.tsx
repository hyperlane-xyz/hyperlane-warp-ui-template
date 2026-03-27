import { WalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';
import { PropsWithChildren } from 'react';

export function TronWalletContext({ children }: PropsWithChildren<unknown>) {
  return <WalletProvider>{children}</WalletProvider>;
}
