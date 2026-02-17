import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { bytesToProtocolAddress, fromHexString, parseWarpRouteMessage } from '@hyperlane-xyz/utils';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { logger } from '../../utils/logger';
import { executeGraphQLQuery } from './graphqlClient';
import { buildMessageHistoryQuery } from './queries/build';
import {
  postgresByteaToAddress,
  postgresByteaToString,
  postgresByteaToTxHash,
} from './queries/encoding';
import { MessageStubEntry } from './queries/fragments';
import { MessageStatus, MessageStub, WarpTransferInfo } from './types';

const PAGE_LIMIT = 15;
const REFRESH_INTERVAL_MS = 60_000;

interface UseMessageHistoryResult {
  messages: MessageStub[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

interface PageResult {
  messages: MessageStub[];
  rawCount: number; // Raw DB rows fetched (before parsing/filtering)
}

export function useMessageHistory(
  walletAddresses: string[],
  warpRouteAddresses: string[],
  multiProvider: MultiProtocolProvider,
): UseMessageHistoryResult {
  const walletKey = useMemo(() => JSON.stringify([...walletAddresses].sort()), [walletAddresses]);
  const warpRouteKey = useMemo(
    () => JSON.stringify([...warpRouteAddresses].sort()),
    [warpRouteAddresses],
  );

  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ['messageHistory', walletKey, warpRouteKey] as const,
    [walletKey, warpRouteKey],
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, isFetchingNextPage, error, hasNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey,
      queryFn: async ({ pageParam }): Promise<PageResult> => {
        const wallets = JSON.parse(walletKey) as string[];
        const warpRoutes = JSON.parse(warpRouteKey) as string[];

        if (!wallets.length || !warpRoutes.length) return { messages: [], rawCount: 0 };

        const queryData = buildMessageHistoryQuery(wallets, warpRoutes, PAGE_LIMIT, pageParam);
        if (!queryData) return { messages: [], rawCount: 0 };

        const result = await executeGraphQLQuery<{ message_view: MessageStubEntry[] }>(
          queryData.query,
          queryData.variables,
        );

        if (result.error) throw result.error;

        const entries = result.data?.message_view;
        if (!entries?.length) return { messages: [], rawCount: 0 };

        const messages = entries
          .map((entry) => parseMessageEntry(entry, multiProvider))
          .filter((m): m is MessageStub => m !== null);

        return { messages, rawCount: entries.length };
      },
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) => {
        if (lastPage.rawCount < PAGE_LIMIT) return undefined;
        // Use raw DB row count for offset to avoid drift when parseMessageEntry filters entries
        return allPages.reduce((acc, page) => acc + page.rawCount, 0);
      },
      enabled: walletAddresses.length > 0 && warpRouteAddresses.length > 0,
      refetchInterval: REFRESH_INTERVAL_MS,
      refetchOnWindowFocus: false,
    });

  const messages = useMemo(() => {
    if (!data?.pages) return [];
    const seen = new Set<string>();
    const result: MessageStub[] = [];
    for (const page of data.pages) {
      for (const msg of page.messages) {
        if (!seen.has(msg.msgId)) {
          seen.add(msg.msgId);
          result.push(msg);
        }
      }
    }
    return result;
  }, [data]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.resetQueries({ queryKey });
    setIsRefreshing(false);
  }, [queryClient, queryKey]);

  return {
    messages,
    isLoading: isLoading || isFetchingNextPage,
    isRefreshing,
    error: error as Error | null,
    hasMore: !!hasNextPage,
    loadMore: () => fetchNextPage(),
    refresh,
  };
}

function parseMessageEntry(
  entry: MessageStubEntry,
  multiProvider: MultiProtocolProvider,
): MessageStub | null {
  try {
    const originMetadata = multiProvider.tryGetChainMetadata(entry.origin_domain_id);
    const destinationMetadata = multiProvider.tryGetChainMetadata(entry.destination_domain_id);

    let warpTransfer: WarpTransferInfo | undefined;
    if (entry.message_body && destinationMetadata) {
      try {
        const body = postgresByteaToString(entry.message_body);
        const parsed = parseWarpRouteMessage(body);
        // Convert recipient from bytes32 to proper address format for destination chain
        const recipientBytes = fromHexString(parsed.recipient);
        const recipientAddress = bytesToProtocolAddress(
          recipientBytes,
          destinationMetadata.protocol,
          destinationMetadata.bech32Prefix,
        );
        warpTransfer = {
          recipient: recipientAddress,
          amount: parsed.amount.toString(),
        };
      } catch {
        // Not a warp transfer message or parsing failed
      }
    }

    let destination: MessageStub['destination'];
    if (
      entry.is_delivered &&
      entry.delivery_occurred_at &&
      entry.destination_tx_hash &&
      entry.destination_tx_sender &&
      entry.destination_tx_recipient
    ) {
      destination = {
        timestamp: parseTimestamp(entry.delivery_occurred_at),
        hash: postgresByteaToTxHash(entry.destination_tx_hash, destinationMetadata),
        from: postgresByteaToAddress(entry.destination_tx_sender, destinationMetadata),
        to: postgresByteaToAddress(entry.destination_tx_recipient, destinationMetadata),
      };
    }

    return {
      status: entry.is_delivered ? MessageStatus.Delivered : MessageStatus.Pending,
      id: entry.id.toString(),
      msgId: postgresByteaToString(entry.msg_id),
      nonce: entry.nonce,
      sender: postgresByteaToAddress(entry.sender, originMetadata),
      recipient: postgresByteaToAddress(entry.recipient, destinationMetadata),
      originChainId: entry.origin_chain_id,
      originDomainId: entry.origin_domain_id,
      destinationChainId: entry.destination_chain_id,
      destinationDomainId: entry.destination_domain_id,
      origin: {
        timestamp: parseTimestamp(entry.send_occurred_at),
        hash: postgresByteaToTxHash(entry.origin_tx_hash, originMetadata),
        from: postgresByteaToAddress(entry.origin_tx_sender, originMetadata),
        to: postgresByteaToAddress(entry.origin_tx_recipient, originMetadata),
      },
      destination,
      warpTransfer,
    };
  } catch (err) {
    logger.error('Failed to parse message entry', entry.id, err);
    return null;
  }
}

function parseTimestamp(t: string): number {
  const asUtc = t.at(-1) === 'Z' ? t : t + 'Z';
  return new Date(asUtc).getTime();
}
