import type { AssetList, Chain as CosmosChain } from '@chain-registry/types';
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
  ChainMetadataSchema.and(z.object({ mailbox: z.string().optional() })),
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

export function getCosmosKitConfig(): { chains: CosmosChain[]; assets: AssetList[] } {
  const cosmosChains = Object.values(getChainConfigs()).filter(
    (c) => c.protocol === ProtocolType.Cosmos,
  );
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
      rest: [
        {
          address: c.rpcUrls[1].http,
          provider: c.displayName || c.name,
        },
      ],
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
  // TODO cosmos cleanup here
  const assets = cosmosChains.map((c) => {
    if (!c.nativeToken) throw new Error(`Missing native token for ${c.name}`);
    return {
      chain_name: c.name,
      assets: [
        {
          description: `The native token of ${c.displayName || c.name} chain.`,
          denom_units: [
            // {
            //   denom: `u${c.nativeToken.symbol}`,
            //   exponent: 0,
            // },
            {
              denom: 'token',
              exponent: c.nativeToken.decimals,
            },
          ],
          // base: `u${c.nativeToken.symbol}`,
          // name: c.nativeToken.name,
          // display: c.nativeToken.symbol,
          // symbol: c.nativeToken.symbol,
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

// TODO this assumes a single cosmos chain per app instance.
// This is useful because the wallet hooks currently assume one connection per wallet
// but in Cosmos-land connections are per-chain.
let cosmosChainName: string;
export function getCosmosChainName() {
  if (!cosmosChainName) {
    cosmosChainName = getCosmosKitConfig()?.chains?.[0]?.chain_name || 'cosmoshub';
  }
  return cosmosChainName;
}
