import {
  AccountProvider,
  GatewayApiProvider,
  PopupProvider,
  RdtProvider,
} from '@hyperlane-xyz/widgets';
import '@interchain-ui/react/styles';
import { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk';
import { RadixDappToolkit, RadixNetwork } from '@radixdlt/radix-dapp-toolkit';
import { PropsWithChildren } from 'react';

export function RadixWalletContext({ children }: PropsWithChildren<unknown>) {
  const rdt = RadixDappToolkit({
    networkId: RadixNetwork.Stokenet,
    applicationVersion: '1.0.0',
    applicationName: 'Radix Web3 dApp',
    applicationDappDefinitionAddress:
      'account_rdx129zzrj4mwjwec8e6rmsvcz0hx4lp7uj3kf73w8rd2fek4cryaemewh',
    useCache: false,
  });

  const gatewayApi = GatewayApiClient.initialize(rdt.gatewayApi.clientConfig);

  return (
    <RdtProvider value={rdt}>
      <GatewayApiProvider value={gatewayApi}>
        <AccountProvider>
          <PopupProvider>{children}</PopupProvider>
        </AccountProvider>
      </GatewayApiProvider>
    </RdtProvider>
  );
}
