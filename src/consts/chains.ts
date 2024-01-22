import { ChainMap, ChainMetadata, ExplorerFamily } from '@hyperlane-xyz/sdk';
import { chainMetadata, etherToken, solToken } from '@hyperlane-xyz/sdk/dist/consts/chainMetadata';
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
    mailbox: 'Ge9atjAc3Ltu91VTbNpJDCjZ9CFxFyck4h3YBcTF9XPq',
  },
  solanatestnet: {
    blockExplorers: [
      {
        apiUrl: 'https://explorer.solana.com',
        family: ExplorerFamily.Other,
        name: 'Solana Explorer',
        url: 'https://explorer.solana.com',
      },
    ],
    blocks: {
      confirmations: 1,
      estimateBlockTime: 0.4,
      reorgPeriod: 0,
    },
    chainId: 1399811150,
    displayName: 'Solana Testnet',
    displayNameShort: 'Sol Testnet',
    domainId: 1399811150,
    isTestnet: true,
    name: 'solanatestnet',
    nativeToken: solToken,
    protocol: ProtocolType.Sealevel,
    rpcUrls: [{ http: 'https://api.testnet.solana.com' }],
    mailbox: '75HBBLae3ddeneJVrZeyrDfv6vb7SMC3aCpBucSXS5aR'
  },
  eclipsetestnet: {
    blockExplorers: [
      {
        apiUrl: 'https://testnet.dev2.eclipsenetwork.xyz',
        family: ExplorerFamily.Other,
        name: 'Eclipse Testnet Explorer',
        url: 'https://explorer.dev.eclipsenetwork.xyz/?cluster=testnet',
      },
    ],
    blocks: {
      confirmations: 1,
      estimateBlockTime: 0.4,
      reorgPeriod: 0,
    },
    chainId: 239092742,
    displayName: 'Eclipse Testnet',
    domainId: 239092742,
    isTestnet: true,
    name: 'eclipsetestnet',
    nativeToken: {
      ...etherToken,
      decimals: 9,
    },
    protocol: ProtocolType.Sealevel,
    rpcUrls: [{ http: 'https://testnet.dev2.eclipsenetwork.xyz' }],
    mailbox: '75HBBLae3ddeneJVrZeyrDfv6vb7SMC3aCpBucSXS5aR'
  },
  proteustestnet: {
    chainId: 88002,
    domainId: 88002,
    name: 'proteustestnet',
    protocol: ProtocolType.Ethereum,
    displayName: 'Proteus Testnet',
    displayNameShort: 'Proteus',
    nativeToken: {
      name: 'Zebec',
      symbol: 'ZBC',
      decimals: 18,
    },
    rpcUrls: [
      {
        http: 'https://api.proteus.nautchain.xyz/solana',
      },
    ],
    blockExplorers: [
      {
        name: 'Proteus Explorer',
        url: 'https://proteus.nautscan.com/proteus',
        apiUrl: 'https://proteus.nautscan.com/proteus',
        family: ExplorerFamily.Other,
      },
    ],
    mailbox: '0x918D3924Fad8F71551D9081172e9Bb169745461e',
  },
  nautilus: {
    chainId: 22222,
    domainId: 22222,
    name: 'nautilus',
    protocol: ProtocolType.Ethereum,
    displayName: 'Nautilus',
    logoURI: 'https://www.nautchain.xyz/media/nuatchain_media_kit/naut_sq.png',
    nativeToken: {
      name: 'Zebec',
      symbol: 'ZBC',
      decimals: 18,
    },
    rpcUrls: [
      {
        http: 'https://api.nautilus.nautchain.xyz',
      },
    ],
    blocks: {
      confirmations: 1,
      reorgPeriod: 1,
      estimateBlockTime: 1,
    },
    mailbox: '0xF59557dfacDc5a1cb8A36Af43aA4819a6A891e88',
  },
};
