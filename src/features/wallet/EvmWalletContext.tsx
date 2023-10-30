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
import { PropsWithChildren, useMemo } from 'react';
import { WagmiConfig, configureChains, createClient } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';

import { ProtocolType } from '@hyperlane-xyz/utils';

import { APP_NAME } from '../../consts/app';
import { config } from '../../consts/config';
import { tokenList } from '../../consts/tokens';
import { Color } from '../../styles/Color';
import { getWagmiChainConfig } from '../chains/metadata';
import { getMultiProvider } from '../multiProvider';

const { chains, provider } = configureChains(getWagmiChainConfig(), [publicProvider()]);

const connectorConfig = {
  appName: APP_NAME,
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
  const initialChain = useMemo(() => {
    const multiProvider = getMultiProvider();
    return tokenList.filter(
      (token) =>
        multiProvider.tryGetChainMetadata(token.chainId)?.protocol === ProtocolType.Ethereum,
    )?.[0]?.chainId as number;
  }, []);
  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider
        chains={chains}
        theme={lightTheme({
          accentColor: Color.primaryBlue,
          borderRadius: 'small',
          fontStack: 'system',
        })}
        initialChain={initialChain}
      >
        {children}
      </RainbowKitProvider>
    </WagmiConfig>
  );
}
