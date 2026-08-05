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
  msgId: string | undefined;
  destinationChain: ChainName | undefined;
  chainAddresses: ChainMap<ChainAddresses>;
  multiProvider: MultiProtocolProvider;
  enabled: boolean;
}) {
  const mailbox = destinationChain ? chainAddresses[destinationChain]?.mailbox : undefined;
  const { data } = useQuery({
    queryKey: ['evmMailboxDelivery', destinationChain, mailbox, msgId],
    queryFn: async () => {
      if (!destinationChain || !msgId) {
        return { isDelivered: false, destinationTxHash: undefined };
      }
      return getMailboxDeliveryStatus({ msgId, destinationChain, chainAddresses, multiProvider });
    },
    enabled: enabled && !!msgId && !!destinationChain && !!mailbox,
    refetchInterval: (query) => {
      if (query.state.data?.isDelivered && query.state.data.destinationTxHash) return false;
      return MAILBOX_DELIVERY_POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: false,
  });

  return {
    isDelivered: data?.isDelivered ?? false,
    destinationTxHash: data?.destinationTxHash,
  };
}
