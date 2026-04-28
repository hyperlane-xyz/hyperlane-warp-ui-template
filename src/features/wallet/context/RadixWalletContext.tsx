import { AccountProvider } from '@hyperlane-xyz/widgets/walletIntegrations/radix/AccountContext';
import '@interchain-ui/react/styles';
import {
  GatewayApiProvider,
  PopupProvider,
  RdtProvider,
} from '@hyperlane-xyz/widgets/walletIntegrations/radix/RadixProviders';
import { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk';
import { RadixDappToolkit, RadixNetwork } from '@radixdlt/radix-dapp-toolkit';
import { PropsWithChildren } from 'react';

import { APP_NAME } from '../../../consts/app';
import { E2EAutoConnectRadix } from '../_e2e/E2EAutoConnectRadix';
import { isE2EMode } from '../_e2e/isE2E';

export function RadixWalletContext({ children }: PropsWithChildren<unknown>) {
  const rdt = RadixDappToolkit({
    networkId: RadixNetwork.Mainnet,
    applicationVersion: '1.0.0',
    applicationName: APP_NAME,
    dAppDefinitionAddress: 'account_rdx12ycz0wsuygqa5slye9du6e7wz7fr4pzx39l5r5cznqc6yudpks20cw',
    useCache: false,
  });

  const gatewayApi = GatewayApiClient.initialize(rdt.gatewayApi.clientConfig);

  return (
    <RdtProvider value={rdt}>
      <GatewayApiProvider value={gatewayApi}>
        <AccountProvider>
          <PopupProvider>
            {isE2EMode() && <E2EAutoConnectRadix />}
            {children}
          </PopupProvider>
        </AccountProvider>
      </GatewayApiProvider>
    </RdtProvider>
  );
}
