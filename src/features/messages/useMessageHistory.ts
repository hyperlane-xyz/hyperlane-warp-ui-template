import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseWarpRouteMessage } from '@hyperlane-xyz/utils';
import { executeGraphQLQuery } from './graphqlClient';
import { buildMessageHistoryQuery } from './queries/build';
import {
  postgresByteaToAddress,
  postgresByteaToString,
  postgresByteaToTxHash,
} from './queries/encoding';
import { MessageStubEntry } from './queries/fragments';
import { MessageStatus, MessageStub, WarpTransferInfo } from './types';
import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';

const PAGE_LIMIT = 15;
const REFRESH_INTERVAL_MS = 60_000;

interface UseMessageHistoryResult {
  messages: MessageStub[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export function useMessageHistory(
  walletAddresses: string[],
  warpRouteAddresses: string[],
  multiProvider: MultiProtocolProvider,
): UseMessageHistoryResult {
  const [messages, setMessages] = useState<MessageStub[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Use refs to avoid dependency issues in callbacks
  const multiProviderRef = useRef(multiProvider);
  multiProviderRef.current = multiProvider;

  // Memoize address lists to avoid unnecessary re-fetches
  const walletKey = useMemo(() => [...walletAddresses].sort().join(','), [walletAddresses]);
  const warpRouteKey = useMemo(() => [...warpRouteAddresses].sort().join(','), [warpRouteAddresses]);
  const walletsRef = useRef<string[]>([]);
  const warpRoutesRef = useRef<string[]>([]);

  // Update refs when keys change
  useEffect(() => {
    walletsRef.current = walletKey ? walletKey.split(',') : [];
  }, [walletKey]);

  useEffect(() => {
    warpRoutesRef.current = warpRouteKey ? warpRouteKey.split(',') : [];
  }, [warpRouteKey]);

  const fetchMessages = useCallback(
    async (offset: number): Promise<MessageStub[]> => {
      const wallets = walletsRef.current;
      const warpRoutes = warpRoutesRef.current;
      if (!wallets.length || !warpRoutes.length) return [];

      const queryData = buildMessageHistoryQuery(wallets, warpRoutes, PAGE_LIMIT, offset);
      if (!queryData) return [];

      const result = await executeGraphQLQuery<{ message_view: MessageStubEntry[] }>(
        queryData.query,
        queryData.variables,
      );

      if (result.error) {
        throw result.error;
      }

      const entries = result.data?.message_view;
      if (!entries?.length) return [];

      return entries
        .map((entry) => parseMessageEntry(entry, multiProviderRef.current))
        .filter((m): m is MessageStub => m !== null);
    },
    [], // No dependencies - uses refs
  );

  // Initial load when addresses change
  useEffect(() => {
    if (!walletKey || !warpRouteKey) {
      setMessages([]);
      setHasMore(true);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchMessages(0);
        if (!cancelled) {
          setMessages(result);
          setHasMore(result.length === PAGE_LIMIT);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [walletKey, warpRouteKey, fetchMessages]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (!walletKey || !warpRouteKey) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMessages(0)
          .then((latest) => {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.msgId));
              const newOnes = latest.filter((m) => !existingIds.has(m.msgId));
              if (newOnes.length === 0) return prev;
              return [...newOnes, ...prev];
            });
          })
          .catch(() => {
            // Silently ignore refresh errors
          });
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [walletKey, warpRouteKey, fetchMessages]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || !walletKey || !warpRouteKey) return;

    setIsLoading(true);
    try {
      const currentLength = messages.length;
      const result = await fetchMessages(currentLength);
      setMessages((prev) => [...prev, ...result]);
      setHasMore(result.length === PAGE_LIMIT);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more messages'));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, walletKey, warpRouteKey, fetchMessages, messages.length]);

  const refresh = useCallback(async () => {
    if (!walletKey || !warpRouteKey || isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchMessages(0);
      setMessages(result);
      setHasMore(result.length === PAGE_LIMIT);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh messages'));
    } finally {
      setIsLoading(false);
    }
  }, [walletKey, warpRouteKey, isLoading, fetchMessages]);

  return { messages, isLoading, error, hasMore, loadMore, refresh };
}

function parseMessageEntry(
  entry: MessageStubEntry,
  multiProvider: MultiProtocolProvider,
): MessageStub | null {
  try {
    const originMetadata = multiProvider.tryGetChainMetadata(entry.origin_domain_id);
    const destinationMetadata = multiProvider.tryGetChainMetadata(entry.destination_domain_id);

    // Parse warp transfer info from message body
    let warpTransfer: WarpTransferInfo | undefined;
    if (entry.message_body) {
      try {
        const body = postgresByteaToString(entry.message_body);
        const parsed = parseWarpRouteMessage(body);
        warpTransfer = {
          recipient: parsed.recipient,
          amount: parsed.amount.toString(),
        };
      } catch {
        // Not a warp transfer message or parsing failed
      }
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
      destination: entry.is_delivered
        ? {
            timestamp: parseTimestamp(entry.delivery_occurred_at!),
            hash: postgresByteaToTxHash(entry.destination_tx_hash!, destinationMetadata),
            from: postgresByteaToAddress(entry.destination_tx_sender!, destinationMetadata),
            to: postgresByteaToAddress(entry.destination_tx_recipient!, destinationMetadata),
          }
        : undefined,
      warpTransfer,
    };
  } catch {
    return null;
  }
}

function parseTimestamp(t: string): number {
  const asUtc = t.at(-1) === 'Z' ? t : t + 'Z';
  return new Date(asUtc).getTime();
}
