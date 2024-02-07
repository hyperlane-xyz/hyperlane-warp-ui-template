import { ProtocolType } from '@hyperlane-xyz/utils';

import { getWarpContext } from '../context/context';

import { parseCaip2Id } from './caip/chains';

export function getMultiProvider() {
  return getWarpContext().multiProvider;
}

export function getEvmProvider(id: ChainCaip2Id) {
  const { reference, protocol } = parseCaip2Id(id);
  if (protocol !== ProtocolType.Ethereum) throw new Error('Expected EVM chain for provider');
  // TODO viem
  return getMultiProvider().getEthersV5Provider(reference);
}

export function getSealevelProvider(id: ChainCaip2Id) {
  const { reference, protocol } = parseCaip2Id(id);
  if (protocol !== ProtocolType.Sealevel) throw new Error('Expected Sealevel chain for provider');
  return getMultiProvider().getSolanaWeb3Provider(reference);
}

export function getCosmJsWasmProvider(id: ChainCaip2Id) {
  const { reference, protocol } = parseCaip2Id(id);
  if (protocol !== ProtocolType.Cosmos) throw new Error('Expected Cosmos chain for provider');
  return getMultiProvider().getCosmJsWasmProvider(reference);
}

export function getChainMetadata(id: ChainCaip2Id) {
  return getMultiProvider().getChainMetadata(parseCaip2Id(id).reference);
}
