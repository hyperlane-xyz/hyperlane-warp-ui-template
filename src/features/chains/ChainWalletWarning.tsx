import { toTitleCase } from '@hyperlane-xyz/utils';
import {
  useDisconnectFns,
  useWalletDetails,
} from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { useMemo } from 'react';

import { FormWarningBanner } from '../../components/banner/FormWarningBanner';
import { config } from '../../consts/config';
import { logger } from '../../utils/logger';
import { useAppConnectFns } from '../wallet/useAppConnectFns';
import { useMultiProvider } from './hooks';
import { getChainDisplayName } from './utils';

export function ChainWalletWarning({ origin }: { origin: ChainName }) {
  const multiProvider = useMultiProvider();

  const wallets = useWalletDetails();
  const connectFns = useAppConnectFns();
  const disconnectFns = useDisconnectFns();

  const { isVisible, chainDisplayName, walletWhitelist, connectFn, disconnectFn } = useMemo(() => {
    const protocol = multiProvider.tryGetProtocol(origin);
    const walletWhitelist = config.chainWalletWhitelists[origin]?.map((w) =>
      w.trim().toLowerCase(),
    );
    if (!protocol || !walletWhitelist?.length)
      return { isVisible: false, chainDisplayName: '', walletWhitelist: [] };

    const chainDisplayName = getChainDisplayName(multiProvider, origin, true);
    const walletName = wallets[protocol]?.name?.trim()?.toLowerCase();
    const connectFn = connectFns[protocol];
    const disconnectFn = disconnectFns[protocol];
    const isVisible = !!walletName && !walletWhitelist.includes(walletName);

    return { isVisible, chainDisplayName, walletWhitelist, connectFn, disconnectFn };
  }, [multiProvider, origin, wallets, connectFns, disconnectFns]);

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
}
