import type { AssetList, Chain as CosmosChain } from '@chain-registry/types';
import { Chain as WagmiChain } from 'wagmi/chains';

import { ChainMetadata, ChainName, chainMetadataToWagmiChain } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { getTokens, getWarpContext } from '../../context/context';

import { cosmosDefaultChain } from './cosmosDefault';

// Metadata formatted for use in Wagmi config
export function getWagmiChainConfig(): WagmiChain[] {
  const evmChains = Object.values(getWarpContext().chains).filter(
    (c) => !c.protocol || c.protocol === ProtocolType.Ethereum,
  );
  return evmChains.map(chainMetadataToWagmiChain);
}

export function getCosmosKitConfig(): { chains: CosmosChain[]; assets: AssetList[] } {
  const cosmosChains = getCosmosChains();
  const chains = cosmosChains.map((c) => ({
    chain_name: c.name,
    chain_type: 'cosmos' as const,
    status: 'live' as const,
    network_type: (c.isTestnet ? 'testnet' : 'mainnet') as 'testnet' | 'mainnet',
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
          type_asset: 'cw20' as const,
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
          type_asset: 'cw20' as const,
        },
      ],
    };
  });

  return { chains, assets };
}

export function getCosmosChainNames(): ChainName[] {
  return getCosmosChains().map((c) => c.name);
}

export function getCosmosChains(): ChainMetadata[] {
  const tokens = getTokens();
  const chains = Object.values(getWarpContext().chains).filter(
    (c) => c.protocol === ProtocolType.Cosmos && tokens.some((t) => t.chainName === c.name),
  );
  return [...chains, cosmosDefaultChain];
}
