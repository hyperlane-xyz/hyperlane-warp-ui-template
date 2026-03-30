import { AleoPopupProvider } from '@hyperlane-xyz/widgets/walletIntegrations/aleo/AleoProviders';
import { AleoWalletProvider } from '@provablehq/aleo-wallet-adaptor-react';
import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adaptor-shield';
import { PropsWithChildren } from 'react';
type WalletContextProps = PropsWithChildren<{ enabled?: boolean }>;

export function AleoWalletContext({ children, enabled = true }: WalletContextProps) {
  if (!enabled) return <>{children}</>;
  const wallets = [new ShieldWalletAdapter()];

  return (
    <AleoWalletProvider wallets={wallets}>
      <AleoPopupProvider>{children}</AleoPopupProvider>
    </AleoWalletProvider>
  );
}
