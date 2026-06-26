import type { ChainAddresses } from '@hyperlane-xyz/registry';
import type { ChainMap, ChainName, MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { SealevelCoreAdapter } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { useQuery } from '@tanstack/react-query';

import { logger } from '../../utils/logger';

const SOLANA_MAILBOX_DELIVERY_POLL_INTERVAL_MS = 5_000;

async function getSolanaMailboxDeliveryStatus({
  msgId,
  destinationChain,
  chainAddresses,
  multiProvider,
}: {
  msgId: string;
  destinationChain: ChainName;
  chainAddresses: ChainMap<ChainAddresses>;
  multiProvider: MultiProtocolProvider;
}): Promise<{ isDelivered: boolean; destinationTxHash: undefined }> {
  try {
    if (multiProvider.tryGetProtocol(destinationChain) !== ProtocolType.Sealevel) {
      return { isDelivered: false, destinationTxHash: undefined };
    }

    const mailbox = chainAddresses[destinationChain]?.mailbox;
    if (!mailbox) return { isDelivered: false, destinationTxHash: undefined };

    const adapter = new SealevelCoreAdapter(destinationChain, multiProvider, { mailbox });
    const isDelivered = await adapter.isDelivered(msgId);
    return { isDelivered, destinationTxHash: undefined };
  } catch (err) {
    logger.warn('Solana mailbox delivery check failed', err as Error);
    return { isDelivered: false, destinationTxHash: undefined };
  }
}

export function useSolanaMailboxDeliveryStatus({
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
  const mailbox = destinationChain ? chainAddresses[destinationChain]?.mailbox : undefined;
  const destinationProtocol = destinationChain
    ? multiProvider.tryGetProtocol(destinationChain)
    : undefined;
  const { data } = useQuery({
    queryKey: ['solanaMailboxDelivery', destinationChain, mailbox, msgId],
    queryFn: async () => {
      if (!destinationChain) return { isDelivered: false, destinationTxHash: undefined };
      return getSolanaMailboxDeliveryStatus({
        msgId,
        destinationChain,
        chainAddresses,
        multiProvider,
      });
    },
    enabled: shouldEnableSolanaMailboxDeliveryStatus({
      enabled,
      destinationChain,
      mailbox,
      destinationProtocol,
    }),
    refetchInterval: (query) => {
      if (query.state.data?.isDelivered) return false;
      return SOLANA_MAILBOX_DELIVERY_POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: false,
  });

  return {
    isDelivered: data?.isDelivered ?? false,
    destinationTxHash: data?.destinationTxHash,
  };
}

export function shouldEnableSolanaMailboxDeliveryStatus({
  enabled,
  destinationChain,
  mailbox,
  destinationProtocol,
}: {
  enabled: boolean;
  destinationChain: ChainName | undefined;
  mailbox: string | undefined;
  destinationProtocol: ProtocolType | null | undefined;
}) {
  return (
    enabled && !!destinationChain && !!mailbox && destinationProtocol === ProtocolType.Sealevel
  );
}
