import { AleoNetwork, setAleoNetwork } from '@hyperlane-xyz/widgets/walletIntegrations/aleo';
import { AleoPopupProvider } from '@hyperlane-xyz/widgets/walletIntegrations/aleo/AleoProviders';
import { AleoWalletProvider } from '@provablehq/aleo-wallet-adaptor-react';
import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adaptor-shield';
import { PropsWithChildren } from 'react';

import { config } from '../../../consts/config';

setAleoNetwork(config.aleoNetwork === 'mainnet' ? AleoNetwork.MAINNET : AleoNetwork.TESTNET);

export function AleoWalletContext({ children }: PropsWithChildren<unknown>) {
  const wallets = [new ShieldWalletAdapter()];

  return (
    <AleoWalletProvider wallets={wallets}>
      <AleoPopupProvider>{children}</AleoPopupProvider>
    </AleoWalletProvider>
  );
}
