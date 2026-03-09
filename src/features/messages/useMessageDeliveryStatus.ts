import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { useQuery } from '@tanstack/react-query';
import { logger } from '../../utils/logger';
import { executeGraphQLQuery } from './graphqlClient';
import { buildMessageByIdQuery } from './queries/build';
import { postgresByteaToTxHash } from './queries/encoding';
import type { MessageStubEntry } from './queries/fragments';

const POLL_INTERVAL_MS = 10_000;

export interface MessageDeliveryResult {
  /** Whether the message has been delivered on destination */
  isDelivered: boolean;
  /** Destination transaction hash (only when delivered) */
  destinationTxHash?: string;
  /** Origin block height (for stage tracking) */
  originBlockHeight?: number;
  /** Origin timestamp in ms */
  originTimestamp?: number;
  /** Destination timestamp in ms (only when delivered) */
  destinationTimestamp?: number;
  /** Nonce of the message */
  nonce?: number;
  /** Origin domain ID */
  originDomainId?: number;
  /** Origin chain ID */
  originChainId?: number;
  /** Destination domain ID */
  destinationDomainId?: number;
  /** Destination chain ID */
  destinationChainId?: number;
  /** Loading state */
  isLoading: boolean;
}

/**
 * Queries GraphQL for a single message by msgId.
 * Polls while the modal is open and message is not yet delivered.
 */
export function useMessageDeliveryStatus(
  msgId: string | undefined,
  isOpen: boolean,
  multiProvider: MultiProtocolProvider,
): MessageDeliveryResult {
  const { data, isLoading } = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps -- multiProvider is stable, adding it causes unnecessary refetches
    queryKey: ['messageDelivery', msgId],
    queryFn: async () => {
      if (!msgId) return null;
      const queryData = buildMessageByIdQuery(msgId);
      const result = await executeGraphQLQuery<{ message_view: MessageStubEntry[] }>(
        queryData.query,
        queryData.variables,
      );
      if (result.type === 'error') {
        logger.error('Failed to query message delivery status', result.error);
        return null;
      }
      const entry = result.data.message_view?.[0];
      if (!entry) return null;
      return parseDeliveryResult(entry, multiProvider);
    },
    enabled: !!msgId && isOpen,
    staleTime: 30_000,
    refetchInterval: (query) => {
      // Stop polling once delivered
      if (query.state.data?.isDelivered) return false;
      return POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: false,
  });

  return {
    isDelivered: data?.isDelivered ?? false,
    destinationTxHash: data?.destinationTxHash,
    originBlockHeight: data?.originBlockHeight,
    originTimestamp: data?.originTimestamp,
    destinationTimestamp: data?.destinationTimestamp,
    nonce: data?.nonce,
    originDomainId: data?.originDomainId,
    originChainId: data?.originChainId,
    destinationDomainId: data?.destinationDomainId,
    destinationChainId: data?.destinationChainId,
    isLoading,
  };
}

function parseDeliveryResult(
  entry: MessageStubEntry,
  multiProvider: MultiProtocolProvider,
): MessageDeliveryResult {
  const destMetadata = multiProvider.tryGetChainMetadata(entry.destination_domain_id);

  return {
    isDelivered: entry.is_delivered,
    destinationTxHash:
      entry.is_delivered && entry.destination_tx_hash
        ? postgresByteaToTxHash(entry.destination_tx_hash, destMetadata)
        : undefined,
    originBlockHeight: entry.origin_block_height ?? undefined,
    originTimestamp: parseTimestamp(entry.send_occurred_at),
    destinationTimestamp: entry.delivery_occurred_at
      ? parseTimestamp(entry.delivery_occurred_at)
      : undefined,
    nonce: entry.nonce,
    originDomainId: entry.origin_domain_id,
    originChainId: entry.origin_chain_id,
    destinationDomainId: entry.destination_domain_id,
    destinationChainId: entry.destination_chain_id,
    isLoading: false,
  };
}

function parseTimestamp(t: string): number {
  const asUtc = t.at(-1) === 'Z' ? t : t + 'Z';
  return new Date(asUtc).getTime();
}
