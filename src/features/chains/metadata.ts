import type { AssetList, Chain as CosmosChain } from '@chain-registry/types';
import {
  IRegistry,
  cosmoshub,
  chainMetadata as publishedChainMetadata,
} from '@hyperlane-xyz/registry';
import {
  ChainMap,
  ChainMetadata,
  ChainMetadataSchema,
  ChainName,
  WarpCore,
  chainMetadataToViemChain,
  mergeChainMetadataMap,
} from '@hyperlane-xyz/sdk';
import { ProtocolType, objMap, promiseObjAll } from '@hyperlane-xyz/utils';
import { Chain as ViemChain } from 'viem';
import { z } from 'zod';
import { chains as ChainsTS } from '../../consts/chains.ts';
import ChainsYaml from '../../consts/chains.yaml';
import { config } from '../../consts/config.ts';
import { logger } from '../../utils/logger.ts';

export async function assembleChainMetadata(
  registry: IRegistry,
  storeMetadataOverrides?: ChainMap<Partial<ChainMetadata | undefined>>,
) {
  // Chains must include a cosmos chain or CosmosKit throws errors
  const result = z.record(ChainMetadataSchema).safeParse({
    cosmoshub,
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

// Metadata formatted for use in Wagmi config
export function getWagmiChainConfig(warpCore: WarpCore): ViemChain[] {
  const evmChains = Object.values(warpCore.multiProvider.metadata).filter(
    (c) =>
      (!c.protocol || c.protocol === ProtocolType.Ethereum) &&
      warpCore.tokens.some((t) => t.chainName === c.name),
  );
  return evmChains.map(chainMetadataToViemChain);
}

export function getCosmosChains(warpCore: WarpCore): ChainMetadata[] {
  const chains = Object.values(warpCore.multiProvider.metadata).filter(
    (c) =>
      c.protocol === ProtocolType.Cosmos && warpCore.tokens.some((t) => t.chainName === c.name),
  );
  return [...chains, cosmoshub];
}

export function getCosmosKitConfig(warpCore: WarpCore): {
  chains: CosmosChain[];
  assets: AssetList[];
} {
  const cosmosChains = getCosmosChains(warpCore);
  const chains = cosmosChains.map((c) => ({
    chain_name: c.name,
    status: 'live',
    network_type: c.isTestnet ? 'testnet' : 'mainnet',
    pretty_name: c.displayName || c.name,
    chain_id: c.chainId as string,
    bech32_prefix: c.bech32Prefix!,
    slip44: c.slip44!,
    apis: {
      rpc: [
        {
          address: c.rpcUrls[0].http,
          provider: c.displayName || c.name,
        },
      ],
      rest: c.restUrls
        ? [
            {
              address: c.restUrls[0].http,
              provider: c.displayName || c.name,
            },
          ]
        : [],
    },
    fees: {
      fee_tokens: [
        {
          denom: 'token',
        },
      ],
    },
    staking: {
      staking_tokens: [
        {
          denom: 'stake',
        },
      ],
    },
  }));
  const assets = cosmosChains.map((c) => {
    if (!c.nativeToken) throw new Error(`Missing native token for ${c.name}`);
    return {
      chain_name: c.name,
      assets: [
        {
          description: `The native token of ${c.displayName || c.name} chain.`,
          denom_units: [
            {
              denom: 'token',
              exponent: c.nativeToken.decimals,
            },
          ],
          base: 'token',
          name: 'token',
          display: 'token',
          symbol: 'token',
        },
        {
          description: `The native token of ${c.displayName || c.name} chain.`,
          denom_units: [
            {
              denom: 'token',
              exponent: c.nativeToken.decimals,
            },
          ],
          base: 'stake',
          name: 'stake',
          display: 'stake',
          symbol: 'stake',
        },
      ],
    };
  });

  return { chains, assets };
}

export function getCosmosChainNames(warpCore: WarpCore): ChainName[] {
  return getCosmosChains(warpCore).map((c) => c.name);
}
