import { ProtocolType } from '@hyperlane-xyz/utils';

import { FormWarningBanner } from '../../components/banner/FormWarningBanner';
import { useMultiProvider } from '../chains/hooks';
import { ProtocolWalletBridge } from './ProtocolWalletBridge';

export function WalletConnectionWarning({ origin }: { origin: ChainName }) {
  const multiProvider = useMultiProvider();
  const protocol = multiProvider.tryGetProtocol(origin);

  if (!protocol) return null;

  return (
    <ProtocolWalletBridge
      protocol={protocol}
      multiProvider={multiProvider}
      chainName={origin}
    >
      {({ walletDetails }) => {
        const walletWarning = walletWarnings[protocol];
        const message =
          walletDetails?.name && walletWarning ? walletWarning[walletDetails.name] : null;
        return <FormWarningBanner isVisible={!!message}>{message}</FormWarningBanner>;
      }}
    </ProtocolWalletBridge>
  );
}

type WalletWarning = Partial<Record<ProtocolType, Record<string, string>>>;

const walletWarnings: WalletWarning = {
  [ProtocolType.Starknet]: {
    metamask:
      'You might need to switch to a funded token in the Metamask Popup when confirming the transaction',
  },
};
