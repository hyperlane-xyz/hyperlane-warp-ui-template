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
  // TODO: RADIX
  // get real dapp definition address
  const rdt = RadixDappToolkit({
    networkId: RadixNetwork.Stokenet,
    applicationVersion: '1.0.0',
    applicationName: 'Radix dApp Sandbox',
    applicationDappDefinitionAddress:
      'account_tdx_2_12yf9gd53yfep7a669fv2t3wm7nz9zeezwd04n02a433ker8vza6rhe',
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
