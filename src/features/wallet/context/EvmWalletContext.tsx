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
import { PropsWithChildren, useMemo, useState } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { Chain } from 'wagmi/chains';

import { ProtocolType } from '@hyperlane-xyz/utils';

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
        wallets: [coinbaseWallet, omniWallet, rainbowWallet, trustWallet, argentWallet],
      },
    ],
    {
      projectId: config.walletConnectProjectId,
      appName: APP_NAME,
    },
  );

  const wagmiConfig = createConfig({
    chains: chains as [Chain, ...Chain[]],
    transports: chains.reduce((transports, chain) => {
      return {
        ...transports,
        [chain.id]: http(),
      };
    }, {}),
    connectors,
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
