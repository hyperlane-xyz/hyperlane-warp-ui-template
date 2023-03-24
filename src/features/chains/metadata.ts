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

export const chainMetadataExtensionSchema = z.object({
  logoImgSrc: z.string(),
});
export type CustomChainMetadata = ChainMetadata & z.infer<typeof chainMetadataExtensionSchema>;
export const chainConfigSchema = ChainMetadataSchema.merge(chainMetadataExtensionSchema);

// export const chainIdToCustomConfig = Object.values(CustomChainConfig).reduce<
//   Record<number, CustomChainMetadata>
// >((result, config) => {
//   result[config.chainId] = config as CustomChainMetadata;
//   return result;
// }, {});

let chainConfigs: ChainMap<ChainMetadata | CustomChainMetadata>;

export function getChainConfigs() {
  if (!chainConfigs) {
    chainConfigs = { ...chainMetadata };
    for (const c of Object.values(CustomChainConfig)) {
      const result = chainConfigSchema.safeParse(c);
      if (!result.success)
        throw new Error(`Invalid chain config for ${c.name}: ${result.error.errors[0].message}`);
      chainConfigs[c.name] = c as CustomChainMetadata;
    }
  }
  return chainConfigs;
}

// Metadata formatted for use in Wagmi config
export function getWagmiChainConfig(): WagmiChain[] {
  return Object.values(getChainConfigs()).map(chainMetadataToWagmiChain);
}
