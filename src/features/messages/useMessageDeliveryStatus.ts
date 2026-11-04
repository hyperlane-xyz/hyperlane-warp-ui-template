import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { RouteResponse } from '../api/types';
import { useStore } from '../store';
import { labelTransferMessages } from '../transfer/engine/messages';
import type { LabeledMsgId } from '../transfer/engine/types';
import { fetchMessages } from './graphqlClient';
import { getMailboxDeliveryStatus, mailboxDeliveryQueryKey } from './mailboxDelivery';
import { LiveConnection } from './messageStream';
import { buildMessageByIdQuery, buildMessagesByOriginTxQuery } from './queries/build';
import {
  parseTimestamp,
  postgresByteaToTxHash,
  postgresByteaToString,
  postgresByteaToAddress,
} from './queries/encoding';
import { useMessageStream } from './useMessageStream';
import { getTransferDeliveryMsgId } from './utils';

type MessageLookup =
  | { msgId: string }
  | { originTxHash: string; originDomainId: number; route?: RouteResponse };
export interface MessageDeliveryResult {
  isDelivered: boolean;
  destinationTxHash?: string;
  originTimestamp?: number;
  originBlockHeight?: number;
  destinationBlockHeight?: number;
  msgIds?: LabeledMsgId[];
  isLoading: boolean;
  error?: Error | null;
  message?: {
    originDomain: number;
    destinationDomain: number;
    body?: string;
    originTxHash: string;
    sender: string;
    recipient: string;
  };
}

/** A snapshot by message ID or origin transaction, kept current by the shared stream. */
export function useMessageDeliveryStatus(
  lookup: MessageLookup | undefined,
  enabled: boolean,
  multiProvider: MultiProtocolProvider,
  {
    destinationChain,
    recheckDelivered = false,
  }: {
    destinationChain?: string;
    recheckDelivered?: boolean;
  } = {},
): MessageDeliveryResult {
  const connection = useMessageStream((state) => state.connection);
  const ready = multiProvider.getKnownChainNames().length > 0;
  const request =
    lookup &&
    ('msgId' in lookup
      ? buildMessageByIdQuery(lookup.msgId)
      : buildMessagesByOriginTxQuery(
          lookup.originTxHash,
          lookup.originDomainId,
          multiProvider.tryGetChainMetadata(lookup.originDomainId),
        ));
  const {
    data: entries,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['messageDelivery', request?.variables],
    queryFn: ({ signal }) => (request ? fetchMessages(request, signal) : []),
    enabled: enabled && ready && !!request,
    staleTime: 30_000,
    refetchInterval: (query) =>
      (connection === LiveConnection.Disconnected || query.state.status === 'error') &&
      (recheckDelivered ||
        !query.state.data?.length ||
        query.state.data.some((row) => !row.is_delivered || !row.destination_tx_hash))
        ? 10_000
        : false,
  });
  const byOriginTx = lookup && 'originTxHash' in lookup;
  const route = byOriginTx ? lookup.route : undefined;
  const data = useMemo(() => {
    if (!entries?.length) return { isDelivered: false };
    const originMetadata = multiProvider.tryGetChainMetadata(entries[0].origin_domain_id);
    const msgIds = byOriginTx
      ? labelTransferMessages(
          entries.map((row) => ({
            msgId: postgresByteaToString(row.msg_id),
            sender: postgresByteaToAddress(row.sender, originMetadata),
            body: row.message_body ? postgresByteaToString(row.message_body) : undefined,
          })),
          route,
        )
      : undefined;
    const deliveryId = getTransferDeliveryMsgId(msgIds);
    const entry =
      entries.find((row) => postgresByteaToString(row.msg_id) === deliveryId) ??
      entries[entries.length - 1];
    const destinationMetadata = multiProvider.tryGetChainMetadata(entry.destination_domain_id);
    return {
      msgIds,
      isDelivered: entry.is_delivered,
      destinationTxHash:
        entry.is_delivered && entry.destination_tx_hash
          ? postgresByteaToTxHash(entry.destination_tx_hash, destinationMetadata)
          : undefined,
      originTimestamp: parseTimestamp(entry.send_occurred_at),
      originBlockHeight: entry.origin_block_height ?? undefined,
      destinationBlockHeight: entry.destination_block_height ?? undefined,
      message: {
        originDomain: entry.origin_domain_id,
        destinationDomain: entry.destination_domain_id,
        body: entry.message_body ? postgresByteaToString(entry.message_body) : undefined,
        originTxHash: postgresByteaToTxHash(entry.origin_tx_hash, originMetadata),
        sender: postgresByteaToAddress(entry.sender, originMetadata),
        recipient: postgresByteaToAddress(entry.recipient, destinationMetadata),
      },
    };
  }, [entries, byOriginTx, route, multiProvider]);
  const chainAddresses = useStore((state) => state.chainAddresses);
  const chain = data.message
    ? (multiProvider.tryGetChainName(data.message.destinationDomain) ?? undefined)
    : destinationChain;
  const metadata = chain ? multiProvider.tryGetChainMetadata(chain) : undefined;
  const msgId = lookup && 'msgId' in lookup ? lookup.msgId : getTransferDeliveryMsgId(data.msgIds);
  const mailbox = chain ? chainAddresses[chain]?.mailbox : undefined;
  const supportsMailbox =
    metadata &&
    [ProtocolType.Ethereum, ProtocolType.Tron, ProtocolType.Sealevel].includes(metadata.protocol);
  const fallback = useQuery({
    queryKey: [...mailboxDeliveryQueryKey(msgId), chain, mailbox, metadata?.rpcUrls],
    queryFn: () => {
      if (!msgId || !chain) throw new Error('Missing mailbox delivery target');
      return getMailboxDeliveryStatus({
        msgId,
        destinationChain: chain,
        chainAddresses,
        multiProvider,
      });
    },
    enabled: enabled && !!msgId && !!mailbox && !!supportsMailbox && !data.destinationTxHash,
    staleTime: 5_000,
    refetchInterval: (query) =>
      !recheckDelivered &&
      query.state.data?.isDelivered &&
      (query.state.data.destinationTxHash || metadata?.protocol === ProtocolType.Sealevel)
        ? false
        : 5_000,
  });
  return {
    ...data,
    isDelivered: data.isDelivered || !!fallback.data?.isDelivered,
    destinationTxHash: data.destinationTxHash ?? fallback.data?.destinationTxHash,
    isLoading: isLoading || fallback.isLoading,
    error: error ?? fallback.error,
  };
}
