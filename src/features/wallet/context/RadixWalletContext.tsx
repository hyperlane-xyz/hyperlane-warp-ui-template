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
    applicationName: 'Hyperlane Test',
    dAppDefinitionAddress: 'account_tdx_2_128l0zrskd4ed4hyee2zw5u3jqry5k939kyn359ltmungvsxn2jxd3d',
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
