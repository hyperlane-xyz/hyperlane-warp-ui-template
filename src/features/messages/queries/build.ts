import type { ChainMetadata } from '@hyperlane-xyz/sdk';

import { stringToPostgresBytea, txHashToPostgresBytea } from './encoding';
import { messageDetailFragment } from './fragments';

const MESSAGE_BY_ID_QUERY = `
  query MessageById($msgId: bytea!) @cached(ttl: 5) {
    message_view(
      where: {msg_id: {_eq: $msgId}},
      limit: 1
    ) {
      ${messageDetailFragment}
    }
  }
`;

const MESSAGES_BY_ORIGIN_TX_QUERY = `
  query MessagesByOriginTx($originTxHash: bytea!, $originDomainId: Int!) @cached(ttl: 5) {
    message_view(
      where: {
        _and: [
          {origin_tx_hash: {_eq: $originTxHash}},
          {origin_domain_id: {_eq: $originDomainId}}
        ]
      },
      order_by: {id: asc}
    ) {
      ${messageDetailFragment}
    }
  }
`;

/**
 * Build a query to fetch a single message by its Hyperlane message ID
 */
export function buildMessageByIdQuery(msgId: string): {
  query: string;
  variables: { msgId: string };
} {
  return {
    query: MESSAGE_BY_ID_QUERY,
    variables: {
      msgId: stringToPostgresBytea(msgId),
    },
  };
}

export function buildMessagesByOriginTxQuery(
  originTxHash: string,
  originDomainId: number,
  originMetadata: ChainMetadata | null | undefined,
): { query: string; variables: { originTxHash: string; originDomainId: number } } | null {
  const originTxHashBytea = txHashToPostgresBytea(originTxHash, originMetadata);
  if (!originTxHashBytea) return null;
  return {
    query: MESSAGES_BY_ORIGIN_TX_QUERY,
    variables: {
      originTxHash: originTxHashBytea,
      originDomainId,
    },
  };
}
