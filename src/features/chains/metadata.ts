import type { Chain as WagmiChain } from '@wagmi/core';

import {
  ChainMap,
  ChainMetadata,
  chainMetadata,
  chainMetadataToWagmiChain,
} from '@hyperlane-xyz/sdk';

import { chains } from '../../consts/chains';
import { solanaChains } from '../../consts/solanaChains';
import { logger } from '../../utils/logger';

import { ChainConfigSchema, CustomChainMetadata, ProtocolType } from './types';

let chainConfigs: ChainMap<ChainMetadata | CustomChainMetadata>;

export function getChainConfigs() {
  if (!chainConfigs) {
    const result = ChainConfigSchema.safeParse(chains);
    if (!result.success) {
      logger.error('Invalid chain config', result.error);
      throw new Error(`Invalid chain config: ${result.error.toString()}`);
    }
    const customChainConfigs = result.data as ChainMap<CustomChainMetadata>;
    chainConfigs = { ...chainMetadata, ...solanaChains, ...customChainConfigs };
  }
  return chainConfigs;
}

// Metadata formatted for use in Wagmi config
export function getWagmiChainConfig(): WagmiChain[] {
  const evmChains = Object.values(getChainConfigs()).filter(
    // @ts-ignore TODO add optional protocol field to ChainMetadata in SDK
    (c) => !c.protocol || c.protocol === ProtocolType.Ethereum,
  );
  return evmChains.map(chainMetadataToWagmiChain);
}
