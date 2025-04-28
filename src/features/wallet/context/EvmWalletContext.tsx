import { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
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
import { createClient, fallback, http } from 'viem';
import { WagmiProvider, createConfig } from 'wagmi';
import { APP_NAME } from '../../../consts/app';
import { config } from '../../../consts/config';
import { Color } from '../../../styles/Color';
import { useMultiProvider } from '../../chains/hooks';
import { useWarpCore } from '../../tokens/hooks';

function initWagmi(multiProvider: MultiProtocolProvider) {
  const chains = getWagmiChainConfigs(multiProvider);

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
      const transport = fallback(chain.rpcUrls.default.http.map((chainHttp) => http(chainHttp)));
      return createClient({ chain, transport });
    },
  });

  return { wagmiConfig, chains };
}

export function EvmWalletContext({ children }: PropsWithChildren<unknown>) {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const { wagmiConfig } = useMemo(() => initWagmi(multiProvider), [multiProvider]);

  const initialChain = useMemo(() => {
    const tokens = warpCore.tokens;
    const firstEvmToken = tokens.filter((token) => token.protocol === ProtocolType.Ethereum)?.[0];
    return multiProvider.tryGetChainMetadata(firstEvmToken?.chainName)?.chainId as number;
  }, [multiProvider, warpCore]);

  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider
        theme={lightTheme({
          accentColor: Color.primary['500'],
          borderRadius: 'small',
          fontStack: 'system',
        })}
        initialChain={initialChain}
      >
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
