import { ChainMetadata } from '@hyperlane-xyz/sdk';

export type CustomChainMetadata = Omit<ChainMetadata, 'name'> & {
  name: string;
};

// Add custom configs here as needed
export const chainIdToCustomConfig: Record<number, CustomChainMetadata> = {
  // Example config:
  // 1234: {
  //   id: 1234,
  //   name: 'mycustomchain',
  //   displayName: 'My Chain',
  //   nativeToken: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  //   publicRpcUrls: [{ http: 'https://mycustomchain-rpc.com' }],
  //   blockExplorers: [
  //     {
  //       name: 'Etherscan',
  //       url: 'https://mycustomchain-scan.com',
  //       apiUrl: 'https://api.mycustomchain-scan.com',
  //       family: ExplorerFamily.Etherscan,
  //     },
  //   ],
  //   blocks: {
  //     confirmations: 1,
  //     reorgPeriod: 1,
  //     estimateBlockTime: 10,
  //   },
  // }
};
