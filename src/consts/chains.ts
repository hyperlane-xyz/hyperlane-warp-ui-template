import { ChainMap, ChainMetadata, ChainTechnicalStack, ExplorerFamily } from '@hyperlane-xyz/sdk';
import { etherToken } from '@hyperlane-xyz/sdk/dist/consts/chainMetadata';
import { ProtocolType } from '@hyperlane-xyz/utils';

// A map of chain names to ChainMetadata
// Chains can be defined here, in chains.json, or in chains.yaml
// Chains already in the SDK need not be included here unless you want to override some fields
// Schema here: https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/sdk/src/metadata/chainMetadataTypes.ts
export const chains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
  ancient8: {
    blockExplorers: [
      {
        apiUrl: 'https://scan.ancient8.gg/api',
        family: ExplorerFamily.Blockscout,
        name: 'Ancient8 Explorer',
        url: 'https://scan.ancient8.gg',
      },
    ],
    blocks: {
      confirmations: 1,
      estimateBlockTime: 2,
      reorgPeriod: 0,
    },
    chainId: 888888888,
    displayName: 'Ancient8',
    domainId: 888888888,
    isTestnet: false,
    name: 'ancient8',
    nativeToken: etherToken,
    gasCurrencyCoinGeckoId: 'ethereum',
    protocol: ProtocolType.Ethereum,
    rpcUrls: [{ http: 'https://rpc.ancient8.gg' }],
    technicalStack: ChainTechnicalStack.Other,
    mailbox: '0x2f2aFaE1139Ce54feFC03593FeE8AB2aDF4a85A7',
  },
};
