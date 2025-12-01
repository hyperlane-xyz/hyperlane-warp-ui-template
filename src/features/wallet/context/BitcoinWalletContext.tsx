import { MempoolSpaceProvider, regtest, signet, testnet } from '@midl-xyz/midl-js-core';
import { MidlProvider } from '@midl-xyz/midl-js-react';
import { createMidlConfig, SatoshiKitProvider } from '@midl-xyz/satoshi-kit';
import '@midl-xyz/satoshi-kit/styles.css';
import { PropsWithChildren, useMemo } from 'react';

// Configure Bitcoin network based on environment
function initBitcoinConfig() {
  const bitcoinNetwork = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'regtest';
  const mempoolRpcUrl = process.env.NEXT_PUBLIC_MEMPOOL_RPC || undefined;

  // Select the network
  let network;
  switch (bitcoinNetwork) {
    case 'testnet':
      network = testnet;
      break;
    case 'signet':
      network = signet;
      break;
    case 'regtest':
      network = regtest;
      break;
    case 'mainnet':
    default:
      network = regtest;
      break;
  }

  // Configure provider
  const providerConfig = mempoolRpcUrl ? { [network.id]: mempoolRpcUrl } : undefined;

  const provider = providerConfig
    ? new MempoolSpaceProvider(providerConfig as any)
    : new MempoolSpaceProvider();

  const config = createMidlConfig({
    networks: [network],
    persist: true,
    provider,
  });

  return { config };
}

export function BitcoinWalletContext({ children }: PropsWithChildren<unknown>) {
  const { config } = useMemo(() => initBitcoinConfig(), []);

  return (
    <MidlProvider config={config}>
      <SatoshiKitProvider>{children}</SatoshiKitProvider>
    </MidlProvider>
  );
}
