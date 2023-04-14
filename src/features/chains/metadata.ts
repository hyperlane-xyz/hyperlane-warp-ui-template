import type { Chain as WagmiChain } from '@wagmi/core';

import {
  ChainMap,
  ChainMetadata,
  chainMetadata,
  chainMetadataToWagmiChain,
} from '@hyperlane-xyz/sdk';

import { chains } from '../../consts/chains';
import { logger } from '../../utils/logger';

import { ChainConfigSchema, CustomChainMetadata } from './types';

let chainConfigs: ChainMap<ChainMetadata | CustomChainMetadata>;

export function getChainConfigs() {
  if (!chainConfigs) {
    const result = ChainConfigSchema.safeParse(chains);
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
