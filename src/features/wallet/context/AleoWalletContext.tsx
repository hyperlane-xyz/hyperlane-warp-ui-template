import { AleoWalletProvider } from '@provablehq/aleo-wallet-adaptor-react';
import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adaptor-shield';
import { PropsWithChildren } from 'react';

export function AleoWalletContext({ children }: PropsWithChildren<unknown>) {
  const wallets = [new ShieldWalletAdapter()];

  return <AleoWalletProvider wallets={wallets}>{children}</AleoWalletProvider>;
}
