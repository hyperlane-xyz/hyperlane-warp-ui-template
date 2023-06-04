import { z } from 'zod';

import { ChainMetadata, ChainMetadataSchema } from '@hyperlane-xyz/sdk';

export enum ProtocolType {
  Ethereum = 'ethereum',
  Sealevel = 'sealevel',
}

export const ChainMetadataExtensionSchema = z.object({
  protocol: z.nativeEnum(ProtocolType).optional(),
  logoURI: z.string().optional(),
});

export type CustomChainMetadata = ChainMetadata & {
  protocol?: `${ProtocolType}`;
  logoURI?: string;
};

export const ChainConfigSchema = z.record(ChainMetadataSchema.merge(ChainMetadataExtensionSchema));
