import { z } from 'zod';

export const messageDetailFragment = `
  msg_id
  sender
  recipient
  is_delivered
  send_occurred_at
  origin_domain_id
  destination_domain_id
  origin_tx_hash
  destination_tx_hash
  message_body
  origin_block_height
  destination_block_height
`;

// Postgres bigint columns are strings on the scraper proxy. Normalize once at the boundary.
export const blockHeightSchema = z
  .union([z.number(), z.string().regex(/^\d+$/)])
  .transform(Number)
  .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER));
export const messageEntrySchema = z.object({
  msg_id: z.string(),
  sender: z.string(),
  recipient: z.string(),
  is_delivered: z.boolean(),
  send_occurred_at: z.string(),
  origin_domain_id: z
    .number()
    .int()
    .transform((domain) => domain >>> 0),
  destination_domain_id: z
    .number()
    .int()
    .transform((domain) => domain >>> 0),
  origin_tx_hash: z.string(),
  destination_tx_hash: z.string().nullable(),
  message_body: z.string().nullable(),
  origin_block_height: blockHeightSchema.nullish(),
  destination_block_height: blockHeightSchema.nullish(),
});
export const messageSnapshotSchema = z.object({ message_view: z.array(messageEntrySchema) });
export type MessageStubEntry = z.infer<typeof messageEntrySchema>;
