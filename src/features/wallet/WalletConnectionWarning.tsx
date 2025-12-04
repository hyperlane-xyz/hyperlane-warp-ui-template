import { ProtocolType } from '@hyperlane-xyz/utils';
import { useWalletDetails } from '@hyperlane-xyz/widgets';
import { useMemo } from 'react';
import { FormWarningBanner } from '../../components/banner/FormWarningBanner';
import { useMultiProvider } from '../chains/hooks';

export function WalletConnectionWarning({ origin }: { origin: ChainName }) {
  const multiProvider = useMultiProvider();
  const walletDetails = useWalletDetails();

  const message = useMemo(() => {
    const protocol = multiProvider.tryGetProtocol(origin);

    if (protocol && walletDetails[protocol] && walletWarnings[protocol]) {
      const protocolWalletDetail = walletDetails[protocol];
      const walletWarning = walletWarnings[protocol];

      if (protocolWalletDetail.name && walletWarning[protocolWalletDetail.name])
        return walletWarning[protocolWalletDetail.name];
    }

    return null;
  }, [multiProvider, origin, walletDetails]);

  return <FormWarningBanner isVisible={!!message}>{message}</FormWarningBanner>;
}

type WalletWarning = Partial<Record<ProtocolType, Record<string, string>>>;

const walletWarnings: WalletWarning = {
  [ProtocolType.Starknet]: {
    metamask:
      'You might need to switch to a funded token in the Metamask Popup when confirming the transaction',
  },
};
