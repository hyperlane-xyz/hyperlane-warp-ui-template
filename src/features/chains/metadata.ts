import { IRegistry, chainMetadata as publishedChainMetadata } from '@hyperlane-xyz/registry';
import {
  ChainMap,
  ChainMetadata,
  ChainMetadataSchema,
  mergeChainMetadataMap,
  RpcUrlSchema,
} from '@hyperlane-xyz/sdk';
import {
  objFilter,
  objMap,
  promiseObjAll,
  ProtocolType,
  tryParseJsonOrYaml,
} from '@hyperlane-xyz/utils';
import { z } from 'zod';
import { chains as ChainsTS } from '../../consts/chains.ts';
import ChainsYaml from '../../consts/chains.yaml';
import { config } from '../../consts/config.ts';
import { links } from '../../consts/links.ts';
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
        logoURI: `${links.imgPath}/chains/${chainName}/logo.svg`,
      }),
    ),
  );
  const mergedChainMetadata = mergeChainMetadataMap(registryChainMetadata, filesystemMetadata);

  const parsedRpcOverridesResult = tryParseJsonOrYaml(config.rpcOverrides);
  const rpcOverrides = z
    .record(RpcUrlSchema)
    .safeParse(parsedRpcOverridesResult.success && parsedRpcOverridesResult.data);
  if (config.rpcOverrides && !rpcOverrides.success) {
    logger.warn('Invalid RPC overrides config', rpcOverrides.error);
  }

  const chainMetadata = objMap(mergedChainMetadata, (chainName, metadata) => {
    const overridesUrl =
      rpcOverrides.success && rpcOverrides.data[chainName]
        ? rpcOverrides.data[chainName]
        : undefined;

    if (!overridesUrl) return metadata;

    // Only EVM supports fallback transport, so we are putting the override at the end
    const rpcUrls =
      metadata.protocol === ProtocolType.Ethereum
        ? [...metadata.rpcUrls, overridesUrl]
        : [overridesUrl, ...metadata.rpcUrls];

    return { ...metadata, rpcUrls };
  });

  const chainMetadataWithOverrides = mergeChainMetadataMap(chainMetadata, storeMetadataOverrides);
  return { chainMetadata, chainMetadataWithOverrides };
}
