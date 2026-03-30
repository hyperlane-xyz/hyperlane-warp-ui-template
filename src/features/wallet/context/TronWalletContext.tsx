import { WalletProvider } from '@tronweb3/tronwallet-adapter-react-hooks';
import { PropsWithChildren } from 'react';

type WalletContextProps = PropsWithChildren<{ enabled?: boolean }>;

export function TronWalletContext({ children, enabled = true }: WalletContextProps) {
  if (!enabled) return <>{children}</>;
  return <WalletProvider>{children}</WalletProvider>;
}
