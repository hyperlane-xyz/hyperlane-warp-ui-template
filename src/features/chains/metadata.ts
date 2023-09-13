import type { Chain as WagmiChain } from '@wagmi/core';
import { z } from 'zod';

import {
  ChainMap,
  ChainMetadata,
  ChainMetadataSchema,
  chainMetadata,
  chainMetadataToWagmiChain,
} from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { chains } from '../../consts/chains';
import { logger } from '../../utils/logger';

let chainConfigs: ChainMap<ChainMetadata & { mailbox?: Address }>;

export const ChainConfigSchema = z.record(
  ChainMetadataSchema.extend({ mailbox: z.string().optional() }),
);

export function getChainConfigs() {
  if (!chainConfigs) {
    const result = ChainConfigSchema.safeParse(chains);
    if (!result.success) {
      logger.error('Invalid chain config', result.error);
      throw new Error(`Invalid chain config: ${result.error.toString()}`);
    }
    const customChainConfigs = result.data as ChainMap<ChainMetadata & { mailbox?: Address }>;
    chainConfigs = { ...chainMetadata, ...customChainConfigs };
  }
  return chainConfigs;
}

// Metadata formatted for use in Wagmi config
export function getWagmiChainConfig(): WagmiChain[] {
  const evmChains = Object.values(getChainConfigs()).filter(
    (c) => !c.protocol || c.protocol === ProtocolType.Ethereum,
  );
  return evmChains.map(chainMetadataToWagmiChain);
}
