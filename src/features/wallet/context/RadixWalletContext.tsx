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
    networkId: RadixNetwork.Mainnet,
    applicationVersion: '1.0.0',
    applicationName: 'Hyperlane Test',
    dAppDefinitionAddress: 'account_rdx12xa2c277wq35qk0sruvtd62t2c4mgvewam2px5jsjt4hlmh6r4cwcm',
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
