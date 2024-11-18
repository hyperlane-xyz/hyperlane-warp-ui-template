import { toTitleCase } from '@hyperlane-xyz/utils';
import { useConnectFns, useDisconnectFns, useWalletDetails } from '@hyperlane-xyz/widgets';
import { useMemo } from 'react';
import { FormWarningBanner } from '../../components/banner/FormWarningBanner';
import { config } from '../../consts/config';
import { logger } from '../../utils/logger';
import { useMultiProvider } from './hooks';
import { getChainDisplayName } from './utils';

export function ChainWalletWarning({ originChain }: { originChain: ChainName }) {
  const multiProvider = useMultiProvider();

  const wallets = useWalletDetails();
  const connectFns = useConnectFns();
  const disconnectFns = useDisconnectFns();

  const { isVisible, chainDisplayName, walletWhitelist, connectFn, disconnectFn } = useMemo(() => {
    const protocol = multiProvider.tryGetProtocol(originChain);
    const walletWhitelist = config.chainWalletWhitelists[originChain]?.map((w) =>
      w.trim().toLowerCase(),
    );
    if (!protocol || !walletWhitelist?.length)
      return { isVisible: false, chainDisplayName: '', walletWhitelist: [] };

    const chainDisplayName = getChainDisplayName(multiProvider, originChain, true);
    const walletName = wallets[protocol]?.name?.trim()?.toLowerCase();
    const connectFn = connectFns[protocol];
    const disconnectFn = disconnectFns[protocol];
    const isVisible = !!walletName && !walletWhitelist.includes(walletName);

    return { isVisible, chainDisplayName, walletWhitelist, connectFn, disconnectFn };
  }, [multiProvider, originChain, wallets, connectFns, disconnectFns]);

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
