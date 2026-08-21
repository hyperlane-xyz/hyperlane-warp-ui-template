import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { useQuery } from '@tanstack/react-query';

import { logger } from '../../utils/logger';
import type { RouteResponse } from '../api/types';
import { labelTransferMessages } from '../transfer/engine/messages';
import type { LabeledMsgId } from '../transfer/engine/types';
import { executeGraphQLQuery } from './graphqlClient';
import { buildMessagesByOriginTxQuery } from './queries/build';
import {
  parseTimestamp,
  postgresByteaToAddress,
  postgresByteaToString,
  postgresByteaToTxHash,
} from './queries/encoding';
import type { MessageStubEntry } from './queries/fragments';
import { getTransferDeliveryMsgId } from './utils';

const POLL_INTERVAL_MS = 10_000;

export interface OriginTxMessagesResult {
  msgIds?: LabeledMsgId[];
  isDelivered: boolean;
  destinationTxHash?: string;
  originTimestamp?: number;
  originBlockHeight?: number;
  isLoading: boolean;
}

export function useOriginTxMessages(
  originTxHash: string | undefined,
  originDomainId: number | undefined,
  route: RouteResponse | undefined,
  enabled: boolean,
  multiProvider: MultiProtocolProvider,
): OriginTxMessagesResult {
  const isMultiProviderReady = multiProvider.getKnownChainNames().length > 0;

  const { data, isLoading } = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps -- multiProvider is stable, adding it causes unnecessary refetches
    queryKey: ['originTxMessages', originTxHash, originDomainId, isMultiProviderReady],
    queryFn: async () => {
      if (!originTxHash || !originDomainId) return null;
      const originMetadata = multiProvider.tryGetChainMetadata(originDomainId);
      const queryData = buildMessagesByOriginTxQuery(originTxHash, originDomainId, originMetadata);
      if (!queryData) return null;
      const result = await executeGraphQLQuery<{ message_view: MessageStubEntry[] }>(
        queryData.query,
        queryData.variables,
      );
      if (result.type === 'error') {
        logger.error('Failed to query origin transaction messages', result.error);
        return null;
      }
      return parseOriginTxMessages(result.data.message_view ?? [], route, multiProvider);
    },
    enabled: enabled && !!originTxHash && !!originDomainId && isMultiProviderReady,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const result = query.state.data;
      if (!result?.msgIds?.length) return POLL_INTERVAL_MS;
      if (!result.isDelivered || !result.destinationTxHash) return POLL_INTERVAL_MS;
      return false;
    },
    refetchOnWindowFocus: false,
  });

  return {
    msgIds: data?.msgIds,
    isDelivered: data?.isDelivered ?? false,
    destinationTxHash: data?.destinationTxHash,
    originTimestamp: data?.originTimestamp,
    originBlockHeight: data?.originBlockHeight,
    isLoading,
  };
}

function parseOriginTxMessages(
  entries: MessageStubEntry[],
  route: RouteResponse | undefined,
  multiProvider: MultiProtocolProvider,
): Omit<OriginTxMessagesResult, 'isLoading'> {
  if (!entries.length) return { isDelivered: false };

  const originMetadata = multiProvider.tryGetChainMetadata(entries[0].origin_domain_id);
  const messages = entries.map((entry) => ({
    msgId: postgresByteaToString(entry.msg_id),
    sender: postgresByteaToAddress(entry.sender, originMetadata),
    body: entry.message_body ? postgresByteaToString(entry.message_body) : undefined,
  }));
  const msgIds = labelTransferMessages(messages, route);
  const deliveryMsgId = getTransferDeliveryMsgId(msgIds);
  const deliveryEntry =
    entries.find((entry) => postgresByteaToString(entry.msg_id) === deliveryMsgId) ??
    entries.at(-1)!;
  const destMetadata = multiProvider.tryGetChainMetadata(deliveryEntry.destination_domain_id);

  return {
    msgIds,
    isDelivered: deliveryEntry.is_delivered,
    destinationTxHash:
      deliveryEntry.is_delivered && deliveryEntry.destination_tx_hash
        ? postgresByteaToTxHash(deliveryEntry.destination_tx_hash, destMetadata)
        : undefined,
    originTimestamp: parseTimestamp(entries[0].send_occurred_at),
    originBlockHeight: entries[0].origin_block_height,
  };
}
