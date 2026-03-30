import { toTitleCase } from '@hyperlane-xyz/utils';

import { FormWarningBanner } from '../../components/banner/FormWarningBanner';
import { config } from '../../consts/config';
import { logger } from '../../utils/logger';
import { ProtocolWalletBridge } from '../wallet/ProtocolWalletBridge';
import { useMultiProvider } from './hooks';
import { getChainDisplayName } from './utils';

export function ChainWalletWarning({ origin }: { origin: ChainName }) {
  const multiProvider = useMultiProvider();
  const protocol = multiProvider.tryGetProtocol(origin);
  const walletWhitelist = config.chainWalletWhitelists[origin]?.map((w) => w.trim().toLowerCase());
  const chainDisplayName = getChainDisplayName(multiProvider, origin, true);

  if (!protocol || !walletWhitelist?.length) return null;

  return (
    <ProtocolWalletBridge
      protocol={protocol}
      multiProvider={multiProvider}
      chainName={origin}
    >
      {({ walletDetails, connectFn, disconnectFn }) => {
        const walletName = walletDetails?.name?.trim()?.toLowerCase();
        const isVisible = !!walletName && !walletWhitelist.includes(walletName);

        const onClickChange = () => {
          if (!connectFn || !disconnectFn) return;
          disconnectFn()
            .then(() => connectFn())
            .catch((err) => logger.error('Error changing wallet connection', err));
        };

        return (
          <FormWarningBanner isVisible={isVisible} cta="Change" onClick={onClickChange}>
            {`${chainDisplayName} requires one of the following wallets: ${walletWhitelist
              .map((w) => toTitleCase(w))
              .join(', ')}`}
          </FormWarningBanner>
        );
      }}
    </ProtocolWalletBridge>
  );
}
