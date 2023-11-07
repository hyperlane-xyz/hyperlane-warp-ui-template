import { ChainMap, ChainMetadata, ExplorerFamily, chainMetadata } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

// A map of chain names to ChainMetadata
export const chains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
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
    ...chainMetadata.solana,
    rpcUrls: [
      {
        http: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      },
    ],
    mailbox: 'TODO',
  },
  solanatestnet: {
    ...chainMetadata.solanatestnet,
    mailbox: 'TODO',
  },
  solanadevnet: {
    ...chainMetadata.solanadevnet,
    mailbox: '4v25Dz9RccqUrTzmfHzJMsjd1iVoNrWzeJ4o6GYuJrVn',
  },
  cosmoshub: {
    protocol: ProtocolType.Cosmos,
    name: 'cosmoshub',
    chainId: 'cosmoshub-4',
    displayName: 'Cosmos Hub',
    domainId: 1234, // TODO
    bech32Prefix: 'cosmos',
    slip44: 118,
    rpcUrls: [
      { http: 'https://rpc-cosmoshub.blockapsis.com' },
      { http: 'https://lcd-cosmoshub.blockapsis.com' },
    ],
    nativeToken: {
      name: 'Atom',
      symbol: 'ATOM',
      decimals: 6,
    },
    logoURI: '/logos/cosmos.svg',
  },
  neutron: {
    protocol: ProtocolType.Cosmos,
    name: 'neutron',
    chainId: 'neutron-1',
    displayName: 'Neutron',
    domainId: 1853125230,
    bech32Prefix: 'neutron',
    slip44: 118,
    rpcUrls: [
      { http: 'https://rpc-kralum.neutron-1.neutron.org' },
      { http: 'grpc-kralum.neutron-1.neutron.org:80' },
    ],
    nativeToken: {
      name: 'Neutron',
      symbol: 'TIA',
      decimals: 6,
    },
    blockExplorers: [
      {
        name: 'MintScan',
        url: 'https://www.mintscan.io/neutron',
        // TODO API not supported, using url to meet validation requirements
        apiUrl: 'https://www.mintscan.io/neutron',
        family: ExplorerFamily.Other,
      },
    ],
    logoURI: '/logos/neutron.svg',
  },
  mantapacific: {
    protocol: ProtocolType.Ethereum,
    domainId: 169,
    chainId: 169,
    name: 'mantapacific',
    displayName: 'Manta Pacific',
    displayNameShort: 'Manta',
    nativeToken: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    blocks: {
      confirmations: 1,
      reorgPeriod: 0,
      estimateBlockTime: 3,
    },
    rpcUrls: [{ http: 'https://pacific-rpc.manta.network/http' }],
    blockExplorers: [
      {
        name: 'Manta Explorer',
        url: 'https://pacific-explorer.manta.network',
        apiUrl: 'https://manta-pacific.calderaexplorer.xyz/api',
        family: ExplorerFamily.Blockscout,
      },
    ],
    logoURI: '/logos/manta.svg',
  },
  celestia: {
    protocol: ProtocolType.Cosmos,
    domainId: 123456789, // TODO not a real domain id
    chainId: 'celestia',
    name: 'celestia',
    displayName: 'Celestia',
    bech32Prefix: 'celestia',
    slip44: 118,
    nativeToken: {
      name: 'Tia',
      symbol: 'TIA',
      decimals: 6,
    },
    rpcUrls: [
      { http: 'https://public-celestia-rpc.numia.xyz' },
      { http: 'https://public-celestia-lcd.numia.xyz' },
    ],
    blockExplorers: [
      {
        name: 'MintScan',
        url: 'https://www.mintscan.io/celestia',
        // TODO API not supported, using url to meet validation requirements
        apiUrl: 'https://www.mintscan.io/celestia',
        family: ExplorerFamily.Other,
      },
    ],
    logoURI: '/logos/celestia.png',
  },
};
