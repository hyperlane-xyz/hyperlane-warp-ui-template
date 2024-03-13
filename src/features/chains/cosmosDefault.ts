import { ChainMetadata } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

export const cosmosDefaultChain: ChainMetadata = {
  protocol: ProtocolType.Cosmos,
  name: 'cosmoshub',
  chainId: 'cosmoshub-4',
  displayName: 'Cosmos Hub',
  domainId: 1234, // TODO
  bech32Prefix: 'cosmos',
  slip44: 118,
  grpcUrls: [{ http: 'grpc-cosmoshub-ia.cosmosia.notional.ventures:443' }],
  rpcUrls: [{ http: 'https://rpc-cosmoshub.blockapsis.com' }],
  restUrls: [{ http: 'https://lcd-cosmoshub.blockapsis.com' }],
  nativeToken: {
    name: 'Atom',
    symbol: 'ATOM',
    decimals: 6,
    denom: 'uatom',
  },
  logoURI: '/logos/cosmos.svg',
};
