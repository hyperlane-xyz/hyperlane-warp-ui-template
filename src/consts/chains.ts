import { ChainMap, ChainMetadata, ExplorerFamily } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

// A map of chain names to ChainMetadata
// Chains can be defined here, in chains.json, or in chains.yaml
// Chains already in the SDK need not be included here unless you want to override some fields
// Schema here: https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/sdk/src/metadata/chainMetadataTypes.ts
export const chains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
  solana: {
    "blockExplorers": [
      {
        "apiUrl": "https://explorer.solana.com?cluster=mainnet-beta",
        "family": ExplorerFamily.Other,
        "name": "Solana Explorer",
        "url": "https://explorer.solana.com?cluster=mainnet-beta"
      }
    ],
    "blocks": {
      "confirmations": 1,
      "estimateBlockTime": 0.4,
      "reorgPeriod": 0
    },
    "chainId": 1399811149,
    "deployer": {
      "name": "Abacus Works",
      "url": "https://www.hyperlane.xyz"
    },
    "displayName": "Solana",
    "domainId": 1399811149,
    "gasCurrencyCoinGeckoId": "solana",
    "name": "solana",
    "nativeToken": {
      "decimals": 9,
      "name": "Solana",
      "symbol": "SOL"
    },
    "protocol": ProtocolType.Sealevel,
    "rpcUrls": [
      {
        "http": process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
      }
    ],
    mailbox: '4rRZgaC1DaCqtWYLzg14ftuXKPuHe1nGEM6ZtNpim3Wz',
  }
  // mycustomchain: {
  //   protocol: ProtocolType.Ethereum,
  //   chainId: 123123,
  //   domainId: 123123,
  //   name: 'mycustomchain',
  //   displayName: 'My Chain',
  //   nativeToken: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  //   rpcUrls: [{ http: 'https://mycustomchain-rpc.com' }],
  //   blockExplorers: [
  //     {
  //       name: 'MyCustomScan',
  //       url: 'https://mycustomchain-scan.com',
  //       apiUrl: 'https://api.mycustomchain-scan.com/api',
  //       family: ExplorerFamily.Etherscan,
  //     },
  //   ],
  //   blocks: {
  //     confirmations: 1,
  //     reorgPeriod: 1,
  //     estimateBlockTime: 10,
  //   },
  //   logoURI: '/logo.svg',
  // },
};
