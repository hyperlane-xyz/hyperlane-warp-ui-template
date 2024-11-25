import { IRegistry, chainMetadata as publishedChainMetadata } from '@hyperlane-xyz/registry';
import {
  ChainMap,
  ChainMetadata,
  ChainMetadataSchema,
  mergeChainMetadataMap,
} from '@hyperlane-xyz/sdk';
import { objFilter, objMap, promiseObjAll } from '@hyperlane-xyz/utils';
import { z } from 'zod';
import { chains as ChainsTS } from '../../consts/chains.ts';
import ChainsYaml from '../../consts/chains.yaml';
import { config } from '../../consts/config.ts';
import { logger } from '../../utils/logger.ts';

export async function assembleChainMetadata(
  chainsInTokens: ChainName[],
  registry: IRegistry,
  storeMetadataOverrides?: ChainMap<Partial<ChainMetadata | undefined>>,
) {
  // Chains must include a cosmos chain or CosmosKit throws errors
  const result = z.record(ChainMetadataSchema).safeParse({
    ...ChainsYaml,
    ...ChainsTS,
  });
  if (!result.success) {
    logger.warn('Invalid chain metadata', result.error);
    throw new Error(`Invalid chain metadata: ${result.error.toString()}`);
  }
  const filesystemMetadata = result.data as ChainMap<ChainMetadata>;

  let registryChainMetadata: ChainMap<ChainMetadata>;
  if (config.registryUrl) {
    logger.debug('Using custom registry metadata from:', config.registryUrl);
    registryChainMetadata = await registry.getMetadata();
  } else {
    logger.debug('Using default published registry');
    registryChainMetadata = publishedChainMetadata;
  }

  // Filter out chains that are not in the tokens config
  registryChainMetadata = objFilter(registryChainMetadata, (c, m): m is ChainMetadata =>
    chainsInTokens.includes(c),
  );

  // TODO have the registry do this automatically
  registryChainMetadata = await promiseObjAll(
    objMap(
      registryChainMetadata,
      async (chainName, metadata): Promise<ChainMetadata> => ({
        ...metadata,
        logoURI: (await registry.getChainLogoUri(chainName)) || undefined,
      }),
    ),
  );

  const chainMetadata = mergeChainMetadataMap(registryChainMetadata, filesystemMetadata);
  const chainMetadataWithOverrides = mergeChainMetadataMap(chainMetadata, storeMetadataOverrides);
  return { chainMetadata, chainMetadataWithOverrides };
}
