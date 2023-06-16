import { z } from 'zod';

import { ChainMetadata, ChainMetadataSchema } from '@hyperlane-xyz/sdk';

export enum ProtocolType {
  Ethereum = 'ethereum',
  Sealevel = 'sealevel',
}

export const ProtocolSmallestUnit = {
  [ProtocolType.Ethereum]: 'wei',
  [ProtocolType.Sealevel]: 'lamports',
};

export const ChainMetadataExtensionSchema = z.object({
  // Extended chain metadata for multi-env support
  // TODO move to SDK (see https://github.com/hyperlane-xyz/hyperlane-monorepo/pull/2203)
  protocol: z.nativeEnum(ProtocolType).optional(),
  mailbox: z.string().nonempty().optional(),
  interchainGasPaymaster: z.string().nonempty().optional(),
  validatorAnnounce: z.string().nonempty().optional(),
  // Additional extensions for use just in UI here
  logoURI: z.string().nonempty().optional(),
});

export type CustomChainMetadata = ChainMetadata &
  Omit<z.infer<typeof ChainMetadataExtensionSchema>, 'protocol'> & {
    // Loosen loose protocol type to allow literal strings
    protocol?: `${ProtocolType}`;
  };

export const ChainConfigSchema = z.record(ChainMetadataSchema.merge(ChainMetadataExtensionSchema));
