import { ChainMap, ChainMetadata } from '@hyperlane-xyz/sdk';

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
  // // Including configs for some Solana chains by default
  // solana: {
  //   ...chainMetadata.solana,
  //   rpcUrls: [
  //     {
  //       http: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  //     },
  //   ],
  //   mailbox: 'TODO',
  // },
  // solanatestnet: {
  //   ...chainMetadata.solanatestnet,
  //   mailbox: 'TODO',
  // },
  // solanadevnet: {
  //   ...chainMetadata.solanadevnet,
  //   mailbox: '4v25Dz9RccqUrTzmfHzJMsjd1iVoNrWzeJ4o6GYuJrVn',
  // },
};
