import { addressToPostgresBytea } from './encoding';
import { messageStubFragment } from './fragments';

/**
 * Build a GraphQL query to fetch messages for wallet addresses filtered by warp routes
 * Uses offset pagination with timestamp sorting
 */
export function buildMessageHistoryQuery(
  walletAddresses: string[],
  warpRouteAddresses: string[],
  limit: number,
  offset: number,
): { query: string; variables: Record<string, unknown> } | null {
  if (!walletAddresses.length || !warpRouteAddresses.length) return null;

  // Convert wallet addresses to bytea format
  const walletBytea = walletAddresses
    .map((addr) => {
      try {
        return addressToPostgresBytea(addr);
      } catch {
        return null;
      }
    })
    .filter((addr): addr is string => !!addr);

  // Convert warp route addresses to bytea format
  const warpRouteBytea = warpRouteAddresses
    .map((addr) => {
      try {
        return addressToPostgresBytea(addr);
      } catch {
        return null;
      }
    })
    .filter((addr): addr is string => !!addr);

  if (!walletBytea.length || !warpRouteBytea.length) return null;

  // Filter: sender is wallet AND (sender or recipient is warp route address)
  const query = `
    query MessageHistory($wallets: [bytea!]!, $warpRoutes: [bytea!]!, $limit: Int!, $offset: Int!) @cached(ttl: 5) {
      message_view(
        limit: $limit,
        offset: $offset,
        order_by: {send_occurred_at: desc},
        where: {
          _and: [
            {origin_tx_sender: {_in: $wallets}},
            {_or: [
              {sender: {_in: $warpRoutes}},
              {recipient: {_in: $warpRoutes}}
            ]}
          ]
        }
      ) {
        ${messageStubFragment}
      }
    }
  `;

  return {
    query,
    variables: {
      wallets: walletBytea,
      warpRoutes: warpRouteBytea,
      limit,
      offset,
    },
  };
}
