import { ProtocolType } from '@hyperlane-xyz/utils';
import { useEffect, useMemo, useRef } from 'react';

import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';
import { ProtocolWalletBridge } from '../wallet/ProtocolWalletBridge';
import { trackEvent } from './utils';
import { EVENT_NAME } from './types';

export function WalletConnectionTracker() {
  const multiProvider = useMultiProvider();
  const { originChainName, destinationChainName } = useStore((s) => ({
    originChainName: s.originChainName,
    destinationChainName: s.destinationChainName,
  }));

  const originProtocol = originChainName
    ? multiProvider.tryGetProtocol(originChainName)
    : undefined;
  const destinationProtocol = destinationChainName
    ? multiProvider.tryGetProtocol(destinationChainName)
    : undefined;
  const normalizedOriginProtocol = originProtocol || undefined;
  const normalizedDestinationProtocol = destinationProtocol || undefined;

  return (
    <ProtocolWalletBridge
      protocol={normalizedOriginProtocol}
      multiProvider={multiProvider}
      chainName={originChainName}
    >
      {({ account: originAccount, walletDetails: originWallet }) => (
        <ProtocolWalletBridge
          protocol={normalizedDestinationProtocol}
          multiProvider={multiProvider}
          chainName={destinationChainName}
        >
          {({ account: destinationAccount, walletDetails: destinationWallet }) => (
            <WalletTrackingCommit
              entries={[
                {
                  protocol: normalizedOriginProtocol,
                  account: originAccount,
                  walletName: originWallet?.name,
                },
                {
                  protocol: normalizedDestinationProtocol,
                  account: destinationAccount,
                  walletName: destinationWallet?.name,
                },
              ]}
            />
          )}
        </ProtocolWalletBridge>
      )}
    </ProtocolWalletBridge>
  );
}

function WalletTrackingCommit({
  entries,
}: {
  entries: Array<{
    protocol?: ProtocolType;
    account?: { addresses: Array<{ address: string }>; isReady: boolean };
    walletName?: string;
  }>;
}) {
  const trackedWalletsRef = useRef<Set<string>>(new Set());

  const uniqueEntries = useMemo(
    () =>
      entries.filter(
        (entry, index) =>
          !!entry.protocol &&
          !!entry.account?.isReady &&
          entries.findIndex(
            (candidate) =>
              candidate.protocol === entry.protocol &&
              candidate.account?.addresses?.[0]?.address === entry.account?.addresses?.[0]?.address,
          ) === index,
      ),
    [entries],
  );

  useEffect(() => {
    for (const entry of uniqueEntries) {
      const protocol = entry.protocol;
      const address = entry.account?.addresses?.[0]?.address;
      if (!protocol || !address) continue;
      if (protocol === ProtocolType.Cosmos) continue;
      if (protocol === ProtocolType.CosmosNative && !address.includes('cosmos')) continue;

      const walletId = `${protocol}:${address}`;
      if (trackedWalletsRef.current.has(walletId)) continue;

      trackedWalletsRef.current.add(walletId);
      trackEvent(EVENT_NAME.WALLET_CONNECTED, {
        protocol,
        walletAddress: address,
        walletName: entry.walletName || 'Unknown',
      });
    }
  }, [uniqueEntries]);

  return null;
}
