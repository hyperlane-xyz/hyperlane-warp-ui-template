import { RainbowKitProvider, connectorsForWallets, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import {
  argentWallet,
  coinbaseWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { PropsWithChildren, useMemo, useState } from 'react';
import { WagmiProvider, createConfig } from 'wagmi';

import { ProtocolType } from '@hyperlane-xyz/utils';

import { createClient, http } from 'viem';
import { APP_NAME } from '../../../consts/app';
import { config } from '../../../consts/config';
import { getWarpCore } from '../../../context/context';
import { Color } from '../../../styles/Color';
import { getWagmiChainConfig } from '../../chains/metadata';
import { tryGetChainMetadata } from '../../chains/utils';

function initWagmi() {
  const chains = getWagmiChainConfig();

  const connectors = connectorsForWallets(
    [
      {
        groupName: 'Recommended',
        wallets: [metaMaskWallet, injectedWallet, walletConnectWallet, ledgerWallet],
      },
      {
        groupName: 'More',
        wallets: [coinbaseWallet, rainbowWallet, trustWallet, argentWallet],
      },
    ],
    { appName: APP_NAME, projectId: config.walletConnectProjectId },
  );

  const wagmiConfig = createConfig({
    // Splice to make annoying wagmi type happy
    chains: [chains[0], ...chains.splice(1)],
    connectors,
    client({ chain }) {
      const transport = http(chain.rpcUrls.default.http[0]);
      return createClient({ chain, transport });
    },
  });

  return { wagmiConfig, chains };
}

export function EvmWalletContext({ children }: PropsWithChildren<unknown>) {
  const [{ wagmiConfig }] = useState(initWagmi());

  const initialChain = useMemo(() => {
    const tokens = getWarpCore().tokens;
    const firstEvmToken = tokens.filter((token) => token.protocol === ProtocolType.Ethereum)?.[0];
    return tryGetChainMetadata(firstEvmToken?.chainName)?.chainId as number;
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider
        theme={lightTheme({
          accentColor: Color.primary,
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
