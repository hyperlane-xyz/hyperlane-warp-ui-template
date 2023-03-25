import type { Chain as WagmiChain } from '@wagmi/core';
import { z } from 'zod';

import {
  ChainMap,
  ChainMetadata,
  ChainMetadataSchema,
  chainMetadata,
  chainMetadataToWagmiChain,
} from '@hyperlane-xyz/sdk';

import CustomChainConfig from '../../consts/chains.json';
import { logger } from '../../utils/logger';

export const ChainMetadataExtensionSchema = z.object({
  logoImgSrc: z.string(),
});
export type CustomChainMetadata = ChainMetadata & z.infer<typeof ChainMetadataExtensionSchema>;
export const ChainConfigSchema = z.record(ChainMetadataSchema.merge(ChainMetadataExtensionSchema));

let chainConfigs: ChainMap<ChainMetadata | CustomChainMetadata>;

export function getChainConfigs() {
  if (!chainConfigs) {
    const result = ChainConfigSchema.safeParse(CustomChainConfig);
    if (!result.success) {
      logger.error('Invalid chain config', result.error);
      throw new Error(`Invalid chain config: ${result.error.toString()}`);
    }
    const customChainConfigs = result.data as ChainMap<CustomChainMetadata>;
    chainConfigs = { ...chainMetadata, ...customChainConfigs };
  }
  return chainConfigs;
}

// Metadata formatted for use in Wagmi config
export function getWagmiChainConfig(): WagmiChain[] {
  return Object.values(getChainConfigs()).map(chainMetadataToWagmiChain);
}
