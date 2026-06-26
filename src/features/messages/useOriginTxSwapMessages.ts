import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { useQuery } from '@tanstack/react-query';

import { logger } from '../../utils/logger';
import type { RouteResponse } from '../api/types';
import type { LabeledMsgId } from '../swap/types';
import { executeGraphQLQuery } from './graphqlClient';
import { buildMessagesByOriginTxQuery } from './queries/build';
import {
  parseTimestamp,
  postgresByteaToAddress,
  postgresByteaToString,
  postgresByteaToTxHash,
} from './queries/encoding';
import type { MessageStubEntry } from './queries/fragments';
import { getSwapDeliveryMsgId } from './utils';

const POLL_INTERVAL_MS = 10_000;

export interface OriginTxSwapMessagesResult {
  msgIds?: LabeledMsgId[];
  isDelivered: boolean;
  destinationTxHash?: string;
  originTimestamp?: number;
  originBlockHeight?: number;
  isLoading: boolean;
}

export function useOriginTxSwapMessages(
  originTxHash: string | undefined,
  originDomainId: number | undefined,
  route: RouteResponse | undefined,
  enabled: boolean,
  multiProvider: MultiProtocolProvider,
): OriginTxSwapMessagesResult {
  const isMultiProviderReady = multiProvider.getKnownChainNames().length > 0;
  const routeLabelKey = getOriginTxSwapMessagesRouteKey(route);

  const { data, isLoading } = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps -- multiProvider is stable; routeLabelKey captures the route data used for recovered labels
    queryKey: [
      'originTxSwapMessages',
      originTxHash,
      originDomainId,
      isMultiProviderReady,
      routeLabelKey,
    ],
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
      return parseOriginTxSwapMessages(result.data.message_view ?? [], route, multiProvider);
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

export function getOriginTxSwapMessagesRouteKey(route: RouteResponse | undefined): string {
  const bridgeRouters =
    route?.steps
      .filter(
        (step): step is Extract<RouteResponse['steps'][number], { type: 'bridge' }> =>
          step.type === 'bridge',
      )
      .map(
        (step) => `${step.chain}-${step.destChain}-${normalizeRecoveredAddressRef(step.router)}`,
      ) ?? [];

  return bridgeRouters.join('|') || 'none';
}

export function parseOriginTxSwapMessages(
  entries: MessageStubEntry[],
  route: RouteResponse | undefined,
  multiProvider: MultiProtocolProvider,
): Omit<OriginTxSwapMessagesResult, 'isLoading'> {
  if (!entries.length) return { isDelivered: false };

  const originMetadata = multiProvider.tryGetChainMetadata(entries[0].origin_domain_id);
  const messages = entries.map((entry) => ({
    msgId: postgresByteaToString(entry.msg_id),
    sender: postgresByteaToAddress(entry.sender, originMetadata),
    body: entry.message_body ? postgresByteaToString(entry.message_body) : undefined,
  }));
  const msgIds = labelRecoveredSwapMessages(messages, route);
  const deliveryMsgId = getSwapDeliveryMsgId(msgIds);
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

function labelRecoveredSwapMessages(
  messages: Array<{ msgId: string; sender: string; body?: string }>,
  route: RouteResponse | undefined,
): LabeledMsgId[] {
  const bridgeRouters = new Set(
    route?.steps
      .filter(
        (step): step is Extract<RouteResponse['steps'][number], { type: 'bridge' }> =>
          step.type === 'bridge',
      )
      .map((step) => normalizeRecoveredAddressRef(step.router)) ?? [],
  );

  return messages.map((message) => {
    const senderAddr = normalizeRecoveredAddressRef(message.sender);
    if (bridgeRouters.has(senderAddr)) return { msgId: message.msgId, label: 'warp' };
    if (message.body?.startsWith('0x01')) return { msgId: message.msgId, label: 'commit' };
    if (message.body?.startsWith('0x02')) return { msgId: message.msgId, label: 'reveal' };
    return { msgId: message.msgId, label: 'warp' };
  });
}

function normalizeRecoveredAddressRef(address: string): string {
  const without0x = address.replace(/^0x/i, '');
  if (address.toLowerCase().startsWith('0x') && /^[0-9a-fA-F]+$/.test(without0x)) {
    return without0x.toLowerCase().slice(-40);
  }
  return address;
}
