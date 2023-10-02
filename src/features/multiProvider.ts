import { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import '../consts/chains';

import { parseCaip2Id } from './caip/chains';
import { getChainConfigs } from './chains/metadata';

let multiProvider: MultiProtocolProvider<{ mailbox?: Address }>;

export function getMultiProvider() {
  if (!multiProvider) {
    multiProvider = new MultiProtocolProvider<{ mailbox?: Address }>(getChainConfigs());
  }
  return multiProvider;
}

export function getEvmProvider(id: ChainCaip2Id) {
  const { reference, protocol } = parseCaip2Id(id);
  if (protocol !== ProtocolType.Ethereum) throw new Error('Expected EVM chain for provider');
  return getMultiProvider().getEthersV5Provider(reference);
}

export function getSealevelProvider(id: ChainCaip2Id) {
  const { reference, protocol } = parseCaip2Id(id);
  if (protocol !== ProtocolType.Sealevel) throw new Error('Expected Sealevel chain for provider');
  return getMultiProvider().getSolanaWeb3Provider(reference);
}

export function getChainMetadata(id: ChainCaip2Id) {
  return getMultiProvider().getChainMetadata(parseCaip2Id(id).reference);
}
