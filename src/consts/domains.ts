import { invertKeysAndValues } from '../utils/objects';

// TODO move these to SDK
// Hard-coding here for better perf and reduced queries
// Should match Domain table in db
export const domainToChain = {
  1000: 44787, // alfajores
  6386274: 42161, // arbitrum
  1634872690: 421611, // arbitrumrinkeby
  421613: 421613, // arbitrumgoerli
  1635069300: 1313161555, // auroratestnet
  1635148152: 43114, // avalanche
  6452067: 56, // bsc
  1651715444: 97, // bsctestnet
  1667591279: 42220, // celo
  6648936: 1, // ethereum
  43113: 43113, // fuji
  5: 5, // goerli
  3000: 42, // kovan
  1836002657: 1287, // moonbasealpha
  1836002669: 1284, // moonbeam
  80001: 80001, // mumbai
  28528: 10, // optimism
  420: 420, // optimismgoerli
  1869622635: 69, // optimismkovan
  1886350457: 137, // polygon
  280: 280, // zksync2testnet
};

export const chainToDomain = invertKeysAndValues(domainToChain);
