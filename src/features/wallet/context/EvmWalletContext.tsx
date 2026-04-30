import { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { getWagmiChainConfigs } from '@hyperlane-xyz/widgets/walletIntegrations/ethereum';
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
import { createClient, fallback, http } from 'viem';
import { WagmiProvider, createConfig, mock } from 'wagmi';

import { APP_NAME } from '../../../consts/app';
import { config } from '../../../consts/config';
import { Color } from '../../../styles/Color';
import { useMultiProvider } from '../../chains/hooks';
import { MOCK_EVM_ADDRESS } from '../_e2e/constants';
import { E2EAutoConnectEvm } from '../_e2e/E2EAutoConnectEvm';
import { isE2EMode } from '../_e2e/isE2E';

function initWagmi(multiProvider: MultiProtocolProvider, e2e: boolean) {
  const chains = getWagmiChainConfigs(multiProvider);

  const baseConnectors = connectorsForWallets(
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

  const connectors = e2e
    ? [mock({ accounts: [MOCK_EVM_ADDRESS], features: { reconnect: true } })]
    : baseConnectors;

  const wagmiConfig = createConfig({
    // Splice to make annoying wagmi type happy
    chains: [chains[0], ...chains.splice(1)],
    connectors,
    client({ chain }) {
      const transport = fallback(chain.rpcUrls.default.http.map((chainHttp) => http(chainHttp)));
      return createClient({ chain, transport });
    },
  });

  return { wagmiConfig, chains };
}

export function EvmWalletContext({ children }: PropsWithChildren<unknown>) {
  const multiProvider = useMultiProvider();
  const e2e = isE2EMode();
  const { wagmiConfig } = useMemo(() => initWagmi(multiProvider, e2e), [multiProvider, e2e]);

  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider
        theme={lightTheme({
          accentColor: Color.primary['500'],
          borderRadius: 'small',
          fontStack: 'system',
        })}
      >
        {e2e && <E2EAutoConnectEvm />}
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
