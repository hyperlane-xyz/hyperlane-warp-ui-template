import { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { getWagmiChainConfigs } from '@hyperlane-xyz/widgets';
import { RainbowKitProvider, connectorsForWallets, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import {
  argentWallet,
  binanceWallet,
  coinbaseWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { PropsWithChildren, useMemo } from 'react';
import { createClient } from 'viem';
import { WagmiProvider, createConfig } from 'wagmi';
import { APP_NAME } from '../../../consts/app';
import { config } from '../../../consts/config';
import { Color } from '../../../styles/Color';
import { useMultiProvider } from '../../chains/hooks';
import { raceTransport, withWcRpcFirst } from '../../chains/rpcUtils';

function initWagmi(multiProvider: MultiProtocolProvider) {
  const rawChains = getWagmiChainConfigs(multiProvider);
  const chains = withWcRpcFirst(rawChains, config.walletConnectProjectId);

  const connectors = connectorsForWallets(
    [
      {
        groupName: 'Recommended',
        wallets: [metaMaskWallet, injectedWallet, walletConnectWallet, ledgerWallet],
      },
      {
        groupName: 'More',
        wallets: [binanceWallet, coinbaseWallet, rainbowWallet, trustWallet, argentWallet],
      },
    ],
    { appName: APP_NAME, projectId: config.walletConnectProjectId },
  );

  const wagmiConfig = createConfig({
    // Splice to make annoying wagmi type happy
    chains: [chains[0], ...chains.splice(1)],
    connectors,
    client({ chain }) {
      return createClient({ chain, transport: raceTransport(chain.rpcUrls.default.http) });
    },
  });

  return { wagmiConfig, chains };
}

export function EvmWalletContext({ children }: PropsWithChildren<unknown>) {
  const multiProvider = useMultiProvider();
  const { wagmiConfig } = useMemo(() => initWagmi(multiProvider), [multiProvider]);

  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider
        theme={lightTheme({
          accentColor: Color.primary['500'],
          borderRadius: 'small',
          fontStack: 'system',
        })}
      >
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
