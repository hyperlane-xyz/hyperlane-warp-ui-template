import { stringToPostgresBytea } from './encoding';
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
