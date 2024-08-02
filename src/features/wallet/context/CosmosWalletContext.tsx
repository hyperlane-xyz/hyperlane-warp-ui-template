import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { GasPrice } from '@cosmjs/stargate';
import { wallets as cosmostationWallets } from '@cosmos-kit/cosmostation';
import { wallets as keplrWallets } from '@cosmos-kit/keplr';
import { wallets as leapWallets } from '@cosmos-kit/leap';
import { ChainProvider } from '@cosmos-kit/react';
import '@interchain-ui/react/styles';
import { PropsWithChildren } from 'react';

import { APP_DESCRIPTION, APP_NAME, APP_URL } from '../../../consts/app';
import { config } from '../../../consts/config';
import { getCosmosKitConfig } from '../../chains/metadata';

const theme = extendTheme({
  fonts: {
    heading: `'Neue Haas Grotesk', 'Helvetica', 'sans-serif'`,
    body: `'Neue Haas Grotesk', 'Helvetica', 'sans-serif'`,
  },
});

export function CosmosWalletContext({ children }: PropsWithChildren<unknown>) {
  const { chains, assets } = getCosmosKitConfig();
  const leapWithoutSnap = leapWallets.filter((wallet) => !wallet.walletName.includes('snap'));
  // TODO replace Chakra here with a custom modal for ChainProvider
  // Using Chakra + @cosmos-kit/react instead of @cosmos-kit/react-lite adds about 600Kb to the bundle
  return (
    <ChakraProvider theme={theme}>
      <ChainProvider
        chains={chains}
        assetLists={assets}
        wallets={[...keplrWallets, ...cosmostationWallets, ...leapWithoutSnap]}
        walletConnectOptions={{
          signClient: {
            projectId: config.walletConnectProjectId,
            metadata: {
              name: APP_NAME,
              description: APP_DESCRIPTION,
              url: APP_URL,
              icons: [],
            },
          },
        }}
        signerOptions={{
          signingCosmwasm: () => {
            return {
              // TODO cosmos get gas price from registry or RPC
              gasPrice: GasPrice.fromString('0.03token'),
            };
          },
          signingStargate: () => {
            return {
              // TODO cosmos get gas price from registry or RPC
              gasPrice: GasPrice.fromString('0.2tia'),
            };
          },
        }}
        modalTheme={{ defaultTheme: 'light' }}
      >
        {children}
      </ChainProvider>
    </ChakraProvider>
  );
}
