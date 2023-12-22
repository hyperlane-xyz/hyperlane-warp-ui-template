import { RainbowKitProvider, connectorsForWallets, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import {
  argentWallet,
  coinbaseWallet,
  injectedWallet, // ledgerWallet,
  metaMaskWallet,
  omniWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { PropsWithChildren, useMemo } from 'react';
import { WagmiConfig, configureChains, createConfig } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';

import { chainMetadata } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { APP_NAME } from '../../../consts/app';
import { config } from '../../../consts/config';
import { tokenList } from '../../../consts/tokens';
import { Color } from '../../../styles/Color';
import { getWagmiChainConfig } from '../../chains/metadata';
import { getMultiProvider } from '../../multiProvider';

const { chains, publicClient } = configureChains(getWagmiChainConfig(), [publicProvider()]);

const connectorConfig = {
  chains,
  publicClient,
  appName: APP_NAME,
  projectId: config.walletConnectProjectId,
};

const connectors = connectorsForWallets([
  {
    groupName: 'Recommended',
    wallets: [
      metaMaskWallet(connectorConfig),
      injectedWallet(connectorConfig),
      walletConnectWallet(connectorConfig),
      // ledgerWallet(connectorConfig),
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

const wagmiConfig = createConfig({
  autoConnect: true,
  publicClient,
  connectors,
});

export function EvmWalletContext({ children }: PropsWithChildren<unknown>) {
  const initialChain = useMemo(() => {
    const multiProvider = getMultiProvider();
    return (tokenList.filter(
      (token) =>
        multiProvider.tryGetChainMetadata(token.chainId)?.protocol === ProtocolType.Ethereum,
    )?.[0]?.chainId || chainMetadata.arbitrum.chainId) as number;
  }, []);
  return (
    <WagmiConfig config={wagmiConfig}>
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
