import {
  ChainMap,
  ChainMetadataWithArtifacts,
  ExplorerFamily,
  ProtocolType,
} from '@hyperlane-xyz/sdk';
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
        http: process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
      },
    ],
    mailbox: 'Ge9atjAc3Ltu91VTbNpJDCjZ9CFxFyck4h3YBcTF9XPq',
    interchainGasPaymaster: '',
    validatorAnnounce: '',
  },
  solanatestnet: {
    ...solanatestnet,
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
    interchainGasPaymaster: '0x06b62A9F5AEcc1E601D0E02732b4E1D0705DE7Db',
    validatorAnnounce: '0xEEea93d0d0287c71e47B3f62AFB0a92b9E8429a1',
  },
  nautilus: {
    chainId: 22222,
    domainId: 22222,
    name: 'nautilus',
    protocol: ProtocolType.Ethereum,
    displayName: 'Nautilus',
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
    interchainGasPaymaster: '0x3a464f746D23Ab22155710f44dB16dcA53e0775E',
    validatorAnnounce: '0x23ce76645EC601148fa451e751eeB75785b97A00',
  },
};
