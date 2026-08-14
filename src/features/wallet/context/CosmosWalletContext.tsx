import { GasPrice } from '@cosmjs/stargate';
import type { WalletModalProps } from '@cosmos-kit/core';
import { wallets as cosmostationWallets } from '@cosmos-kit/cosmostation';
import { wallets as keplrWallets } from '@cosmos-kit/keplr';
import { wallets as leapWallets } from '@cosmos-kit/leap';
import { ChainProvider } from '@cosmos-kit/react-lite';
import { cosmoshub } from '@hyperlane-xyz/registry';
import { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { getCosmosKitChainConfigs } from '@hyperlane-xyz/widgets/walletIntegrations/cosmos';
import '@interchain-ui/react/styles';
import dynamic from 'next/dynamic';
import { PropsWithChildren, useMemo } from 'react';

import { APP_DESCRIPTION, APP_NAME, APP_URL } from '../../../consts/app';
import { config } from '../../../consts/config';
import { useMultiProvider } from '../../chains/hooks';
import { E2EAutoConnectCosmos } from '../_e2e/E2EAutoConnectCosmos';
import { isE2EMode } from '../_e2e/isE2E';
import { MockCosmosWallet } from '../_e2e/MockCosmosWallet';

const LazyCosmosWalletModal = dynamic(
  async () => {
    // DefaultModal reads this provider directly, so keep both in the same lazy chunk.
    const [{ DefaultModal }, { SelectedWalletRepoProvider }] = await Promise.all([
      import('@cosmos-kit/react'),
      import('@cosmos-kit/react/esm/context'),
    ]);

    return function CosmosKitWalletModal(props: WalletModalProps) {
      return (
        <SelectedWalletRepoProvider>
          <DefaultModal {...props} />
        </SelectedWalletRepoProvider>
      );
    };
  },
  { ssr: false },
);

function CosmosWalletModal(props: WalletModalProps) {
  if (!props.isOpen) return <></>;
  return <LazyCosmosWalletModal {...props} />;
}

export function CosmosWalletContext({ children }: PropsWithChildren<unknown>) {
  const chainMetadata = useMultiProvider().metadata;
  const { chains, assets } = useMemo(() => {
    const multiProvider = new MultiProtocolProvider({ ...chainMetadata, cosmoshub });
    return getCosmosKitChainConfigs(multiProvider);
  }, [chainMetadata]);
  const leapWithoutSnap = leapWallets.filter((wallet) => !wallet.walletName.includes('snap'));
  const e2e = isE2EMode();
  // In E2E mode use mock-only — the real Keplr/Cosmostation/Leap adapters
  // each poll for their extension at mount and spam console errors when not
  // installed, polluting test traces. They are not needed when the mock is
  // driving the flow.
  const walletsList = useMemo(() => {
    if (e2e) return [new MockCosmosWallet()];
    return [...keplrWallets, ...cosmostationWallets, ...leapWithoutSnap];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e2e]);
  return (
    <ChainProvider
      chains={chains}
      assetLists={assets}
      wallets={walletsList}
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
      walletModal={CosmosWalletModal}
    >
      {e2e && <E2EAutoConnectCosmos />}
      {children}
    </ChainProvider>
  );
}
