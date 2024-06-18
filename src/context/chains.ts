import { z } from 'zod';

import { GithubRegistry, chainMetadata } from '@hyperlane-xyz/registry';
import { ChainMap, ChainMetadata, ChainMetadataSchema, RpcUrlSchema } from '@hyperlane-xyz/sdk';

import { chains as ChainsTS } from '../consts/chains.ts';
import ChainsYaml from '../consts/chains.yaml';
import { config } from '../consts/config.ts';
import { cosmosDefaultChain } from '../features/chains/cosmosDefault';
import { tryParseJson } from '../utils/json.ts';
import { logger } from '../utils/logger';

export async function assembleChainMetadata() {
  // Chains must include a cosmos chain or CosmosKit throws errors
  const result = z.record(ChainMetadataSchema).safeParse({
    cosmoshub: cosmosDefaultChain,
    ...ChainsYaml,
    ...ChainsTS,
  });
  if (!result.success) {
    logger.warn('Invalid chain config', result.error);
    throw new Error(`Invalid chain config: ${result.error.toString()}`);
  }

  const rpcOverrides = z.record(RpcUrlSchema).safeParse(tryParseJson(config.rpcOverrides));
  if (config.rpcOverrides && !rpcOverrides.success) {
    logger.warn('Invalid RPC overrides config', rpcOverrides.error);
  }

  const customChainMetadata = result.data as ChainMap<ChainMetadata>;

  const registry = new GithubRegistry({ uri: config.registryUrl });
  let defaultChainMetadata = chainMetadata;
  if (config.registryUrl) {
    logger.debug('Using custom registry', config.registryUrl);
    defaultChainMetadata = await registry.getMetadata();
  } else {
    logger.debug('Using default published registry');
    // Note: this is an optional optimization to pre-fetch the content list
    // and avoid repeated request from the chain logos that will use this info
    await registry.listRegistryContent();
  }

  const chains: ChainMap<ChainMetadata> = Object.entries({
    ...defaultChainMetadata,
    ...customChainMetadata,
  }).reduce(
    (accum, [name, chain]) => ({
      ...accum,
      [name]:
        rpcOverrides.success && rpcOverrides.data[name]
          ? {
              ...chain,
              rpcUrls: [rpcOverrides.data[name]],
            }
          : chain,
    }),
    {} as ChainMap<ChainMetadata>,
  );

  return { chains, registry };
}
