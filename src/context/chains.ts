import { z } from 'zod';

import { ChainMap, ChainMetadata, ChainMetadataSchema, chainMetadata } from '@hyperlane-xyz/sdk';

import ChainsJson from '../consts/chains.json';
import { chains as ChainsTS } from '../consts/chains.ts';
import ChainsYaml from '../consts/chains.yaml';
import { cosmosDefaultChain } from '../features/chains/cosmosDefault';
import { logger } from '../utils/logger';

export const ChainConfigSchema = z.record(
  ChainMetadataSchema.and(z.object({ mailbox: z.string().optional() })),
);

export function getChainConfigs() {
  // Chains must include a cosmos chain or CosmosKit throws errors
  const result = ChainConfigSchema.safeParse({
    cosmoshub: cosmosDefaultChain,
    ...ChainsJson,
    ...ChainsYaml,
    ...ChainsTS,
  });
  if (!result.success) {
    logger.warn('Invalid chain config', result.error);
    throw new Error(`Invalid chain config: ${result.error.toString()}`);
  }
  const customChainConfigs = result.data as ChainMap<ChainMetadata & { mailbox?: Address }>;
  return { ...chainMetadata, ...customChainConfigs };
}
