/**
 * GraphQL fragments for message queries
 */
export const messageStubFragment = `
  id
  msg_id
  nonce
  sender
  recipient
  is_delivered
  send_occurred_at
  delivery_occurred_at
  origin_chain_id
  origin_domain_id
  origin_tx_hash
  origin_tx_sender
  origin_tx_recipient
  destination_chain_id
  destination_domain_id
  destination_tx_hash
  destination_tx_sender
  destination_tx_recipient
  message_body
`;

/**
 * Raw message entry from GraphQL
 */
export interface MessageStubEntry {
  id: number;
  msg_id: string; // bytea e.g. \\x123
  nonce: number;
  sender: string; // bytea
  recipient: string; // bytea
  is_delivered: boolean;
  send_occurred_at: string; // e.g. "2022-08-28T17:30:15"
  delivery_occurred_at: string | null;
  origin_chain_id: number;
  origin_domain_id: number;
  origin_tx_hash: string; // bytea
  origin_tx_sender: string; // bytea
  origin_tx_recipient: string; // bytea
  destination_chain_id: number;
  destination_domain_id: number;
  destination_tx_hash: string | null; // bytea
  destination_tx_sender: string | null; // bytea
  destination_tx_recipient: string | null; // bytea
  message_body: string | null; // bytea - contains recipient and amount for warp transfers
}
