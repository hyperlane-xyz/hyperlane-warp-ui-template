import { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk';
import { RadixDappToolkit, RadixNetwork } from '@radixdlt/radix-dapp-toolkit';

import { APP_NAME } from '../../../consts/app';

const RADIX_DAPP_TOOLKIT_CONFIG = {
  networkId: RadixNetwork.Mainnet,
  applicationVersion: '1.0.0',
  applicationName: APP_NAME,
  dAppDefinitionAddress: 'account_rdx12ycz0wsuygqa5slye9du6e7wz7fr4pzx39l5r5cznqc6yudpks20cw',
  useCache: false,
};

function createRadixClients() {
  const rdt = RadixDappToolkit(RADIX_DAPP_TOOLKIT_CONFIG);

  return {
    gatewayApi: GatewayApiClient.initialize(rdt.gatewayApi.clientConfig),
    rdt,
  };
}

let radixClients: ReturnType<typeof createRadixClients> | undefined;

// The wallet context lives for the page lifetime. Retaining one resource here
// prevents React Strict Mode's repeated renders from creating orphaned toolkits.
export function getRadixClients() {
  radixClients ??= createRadixClients();
  return radixClients;
}
