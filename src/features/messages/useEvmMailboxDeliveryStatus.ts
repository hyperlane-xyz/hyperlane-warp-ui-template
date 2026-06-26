import type { ChainAddresses } from '@hyperlane-xyz/registry';
import type { ChainMap, ChainName, MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { getMailboxDeliveryStatus } from './mailboxDelivery';

const MAILBOX_DELIVERY_POLL_INTERVAL_MS = 3_000;
const MAILBOX_DELIVERY_HASH_BACKFILL_WINDOW_MS = 2 * 60 * 1_000;

type MailboxDeliveryQueryResult = {
  isDelivered: boolean;
  destinationTxHash: string | undefined;
};

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
  const deliveredWithoutHashFirstSeenAt = useRef<number | undefined>(undefined);
  const mailbox = destinationChain ? chainAddresses[destinationChain]?.mailbox : undefined;
  const destinationProtocol = destinationChain
    ? multiProvider.tryGetProtocol(destinationChain)
    : undefined;

  useEffect(() => {
    deliveredWithoutHashFirstSeenAt.current = undefined;
  }, [msgId, destinationChain, mailbox]);

  const { data } = useQuery({
    queryKey: ['evmMailboxDelivery', destinationChain, mailbox, msgId],
    queryFn: async () => {
      if (!destinationChain) return { isDelivered: false, destinationTxHash: undefined };
      return getMailboxDeliveryStatus({ msgId, destinationChain, chainAddresses, multiProvider });
    },
    enabled: shouldEnableEvmMailboxDeliveryStatus({
      enabled,
      destinationChain,
      mailbox,
      destinationProtocol,
    }),
    refetchInterval: (query) => {
      return getEvmMailboxDeliveryRefetchInterval(
        query.state.data,
        deliveredWithoutHashFirstSeenAt,
        Date.now(),
      );
    },
    refetchOnWindowFocus: false,
  });

  return {
    isDelivered: data?.isDelivered ?? false,
    destinationTxHash: data?.destinationTxHash,
  };
}

export function shouldEnableEvmMailboxDeliveryStatus({
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
    enabled &&
    !!destinationChain &&
    !!mailbox &&
    (destinationProtocol === ProtocolType.Ethereum || destinationProtocol === ProtocolType.Tron)
  );
}

export function getEvmMailboxDeliveryRefetchInterval(
  result: MailboxDeliveryQueryResult | undefined,
  deliveredWithoutHashFirstSeenAt: { current: number | undefined },
  nowMs: number,
): typeof MAILBOX_DELIVERY_POLL_INTERVAL_MS | false {
  if (!result?.isDelivered) {
    deliveredWithoutHashFirstSeenAt.current = undefined;
    return MAILBOX_DELIVERY_POLL_INTERVAL_MS;
  }
  if (result.destinationTxHash) return false;

  deliveredWithoutHashFirstSeenAt.current ??= nowMs;
  const backfillElapsedMs = nowMs - deliveredWithoutHashFirstSeenAt.current;
  if (backfillElapsedMs >= MAILBOX_DELIVERY_HASH_BACKFILL_WINDOW_MS) return false;

  return MAILBOX_DELIVERY_POLL_INTERVAL_MS;
}
