import type { ChainAddresses } from '@hyperlane-xyz/registry';
import type { ChainMap, ChainName, MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { useQuery } from '@tanstack/react-query';

import { getMailboxDeliveryStatus } from './mailboxDelivery';

const MAILBOX_DELIVERY_POLL_INTERVAL_MS = 3_000;

export function useEvmMailboxDeliveryStatus({
  msgId,
  destinationChain,
  chainAddresses,
  multiProvider,
  enabled,
}: {
  msgId: string;
  destinationChain: ChainName | undefined;
  chainAddresses: ChainMap<ChainAddresses>;
  multiProvider: MultiProtocolProvider;
  enabled: boolean;
}) {
  const { data } = useQuery({
    queryKey: ['evmMailboxDelivery', destinationChain, msgId],
    queryFn: async () => {
      if (!destinationChain) return { isDelivered: false, destinationTxHash: undefined };
      return getMailboxDeliveryStatus({ msgId, destinationChain, chainAddresses, multiProvider });
    },
    enabled: enabled && !!destinationChain,
    refetchInterval: (query) => {
      if (query.state.data?.isDelivered) return false;
      return MAILBOX_DELIVERY_POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: false,
  });

  return {
    isDelivered: data?.isDelivered ?? false,
    destinationTxHash: data?.destinationTxHash,
  };
}
