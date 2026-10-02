import { AleoNetwork, setAleoNetwork } from '@hyperlane-xyz/widgets/walletIntegrations/aleo';
import { AleoPopupProvider } from '@hyperlane-xyz/widgets/walletIntegrations/aleo/AleoProviders';
import type { PropsWithChildren } from 'react';

import { config } from '../../../consts/config';

setAleoNetwork(config.aleoNetwork === 'mainnet' ? AleoNetwork.MAINNET : AleoNetwork.TESTNET);

export function AleoWalletContext({ children }: PropsWithChildren<unknown>) {
  return <AleoPopupProvider>{children}</AleoPopupProvider>;
}
