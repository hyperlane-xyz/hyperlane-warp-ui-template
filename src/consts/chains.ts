import { ChainMap, ChainMetadataWithArtifacts, ExplorerFamily } from '@hyperlane-xyz/sdk';
import { solana, solanadevnet, solanatestnet } from '@hyperlane-xyz/sdk/dist/consts/chainMetadata';

// A map of chain names to ChainMetadata
export const chains: ChainMap<ChainMetadataWithArtifacts> = {
  // ----------- Add your chains here -----------------
  // Chains already in the SDK need not be included here. Example custom chain:
  // mycustomchain: {
  //   protocol: ProtocolType.Ethereum,
  //   chainId: 1234,
  //   domainId: 1234,
  //   name: 'mycustomchain',
  //   displayName: 'My Chain',
  //   nativeToken: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  //   publicRpcUrls: [{ http: 'https://mycustomchain-rpc.com' }],
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

  // Including configs for some Solana chains by default
  solana: {
    ...solana,
    rpcUrls: [
      {
        http: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      },
    ],
    // TODO move up to SDK
    blockExplorers: [
      {
        name: 'Solana Explorer',
        url: 'https://explorer.solana.com',
        apiUrl: 'https://explorer.solana.com',
        family: ExplorerFamily.Other,
      },
    ],
    mailbox: 'TODO',
    interchainGasPaymaster: '',
    validatorAnnounce: '',
  },
  solanatestnet: {
    ...solanatestnet,
    blockExplorers: [
      {
        name: 'Solana Explorer',
        url: 'https://explorer.solana.com',
        apiUrl: 'https://explorer.solana.com',
        family: ExplorerFamily.Other,
      },
    ],
    mailbox: 'TODO',
    interchainGasPaymaster: '',
    validatorAnnounce: '',
  },
  solanadevnet: {
    ...solanadevnet,
    blockExplorers: [
      {
        name: 'Solana Explorer',
        url: 'https://explorer.solana.com',
        apiUrl: 'https://explorer.solana.com',
        family: ExplorerFamily.Other,
      },
    ],
    mailbox: '4v25Dz9RccqUrTzmfHzJMsjd1iVoNrWzeJ4o6GYuJrVn',
    interchainGasPaymaster: '',
    validatorAnnounce: '',
  },
};

export const solanaChainToClusterName = {
  solana: 'mainnet-beta',
  solanatestnet: 'testnet',
  solanadevnet: 'devnet',
};
