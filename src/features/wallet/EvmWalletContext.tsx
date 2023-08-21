import { RainbowKitProvider, connectorsForWallets, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import {
  argentWallet,
  coinbaseWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  omniWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { PropsWithChildren } from 'react';
import { WagmiConfig, configureChains, createClient } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';

import { config } from '../../consts/config';
import { tokenList } from '../../consts/tokens';
import { Color } from '../../styles/Color';
import { getWagmiChainConfig } from '../chains/metadata';

const { chains, provider } = configureChains(getWagmiChainConfig(), [publicProvider()]);

const connectorConfig = {
  appName: 'Hyperlane Warp Template',
  chains,
  projectId: config.walletConnectProjectId,
};

const connectors = connectorsForWallets([
  {
    groupName: 'Recommended',
    wallets: [
      metaMaskWallet(connectorConfig),
      injectedWallet(connectorConfig),
      walletConnectWallet(connectorConfig),
      ledgerWallet(connectorConfig),
    ],
  },
  {
    groupName: 'More',
    wallets: [
      coinbaseWallet(connectorConfig),
      omniWallet(connectorConfig),
      rainbowWallet(connectorConfig),
      trustWallet(connectorConfig),
      argentWallet(connectorConfig),
    ],
  },
]);

const wagmiClient = createClient({
  autoConnect: true,
  provider,
  connectors,
});

export function EvmWalletContext({ children }: PropsWithChildren<unknown>) {
  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider
        chains={chains}
        theme={lightTheme({
          accentColor: Color.primaryBlue,
          borderRadius: 'small',
          fontStack: 'system',
        })}
        initialChain={tokenList[0]?.chainId}
      >
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  );
}
