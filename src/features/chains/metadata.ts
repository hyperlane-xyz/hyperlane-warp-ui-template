import type { AssetList, Chain as CosmosChain } from '@chain-registry/types';
import type { Chain as WagmiChain } from '@wagmi/core';

import { ChainName, chainMetadataToWagmiChain } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { getWarpContext } from '../../context/context';

// Metadata formatted for use in Wagmi config
export function getWagmiChainConfig(): WagmiChain[] {
  const evmChains = Object.values(getWarpContext().chains).filter(
    (c) => !c.protocol || c.protocol === ProtocolType.Ethereum,
  );
  return evmChains.map(chainMetadataToWagmiChain);
}

export function getCosmosKitConfig(): { chains: CosmosChain[]; assets: AssetList[] } {
  const cosmosChains = Object.values(getWarpContext().chains).filter(
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

export function getCosmosChainNames(): ChainName[] {
  return Object.values(getWarpContext().chains)
    .filter((c) => c.protocol === ProtocolType.Cosmos)
    .map((c) => c.name);
}
