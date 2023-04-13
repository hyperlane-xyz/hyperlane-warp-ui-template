import { z } from 'zod';

import { ChainMetadata, ChainMetadataSchema } from '@hyperlane-xyz/sdk';

export const ChainMetadataExtensionSchema = z.object({
  logoURI: z.string().optional(),
});

export type CustomChainMetadata = ChainMetadata & z.infer<typeof ChainMetadataExtensionSchema>;

export const ChainConfigSchema = z.record(ChainMetadataSchema.merge(ChainMetadataExtensionSchema));
