import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk/providers/MultiProtocolProvider';
import { isEVMLike, ProtocolType } from '@hyperlane-xyz/utils';

export interface ReadBalanceArgs {
  chainName: string;
  tokenAddress: string;
  isNative: boolean;
  owner: string;
  standard?: string;
  decimals?: number;
  symbol?: string;
  name?: string;
  coinGeckoId?: string;
  logoURI?: string;
}

// Per-VM dispatch for a single-token balance read.
// EVM-like protocols (Ethereum + Tron) both route through `readEvmBalance`.
// Returns `null` when balance reading isn't supported for the chain's protocol.
export async function readBalance(
  multiProvider: MultiProtocolProvider,
  args: ReadBalanceArgs,
): Promise<bigint | null> {
  const protocol = multiProvider.tryGetProtocol(args.chainName);
  if (!protocol) return null;
  if (isEVMLike(protocol)) {
    const { readEvmBalance } = await import('./evm');
    return readEvmBalance(multiProvider, args);
  }
  if (protocol === ProtocolType.Sealevel) {
    const { readSealevelTokenBalance } = await import('./sealevel');
    return readSealevelTokenBalance(multiProvider, args);
  }
  if (protocol === ProtocolType.Starknet) {
    const { readStarknetTokenBalance } = await import('./starknet');
    return readStarknetTokenBalance(multiProvider, args);
  }
  if (protocol === ProtocolType.Cosmos || protocol === ProtocolType.CosmosNative) {
    const { readCosmosTokenBalance } = await import('./cosmos');
    return readCosmosTokenBalance(multiProvider, args);
  }
  if (protocol === ProtocolType.Radix) {
    const { readRadixTokenBalance } = await import('./radix');
    return readRadixTokenBalance(multiProvider, args);
  }
  if (protocol === ProtocolType.Aleo) {
    const { readAleoTokenBalance } = await import('./aleo');
    return readAleoTokenBalance(multiProvider, args);
  }
  return null;
}

export interface EstimateGasArgs {
  chainName: string;
  sender: string;
  tx: { to: string; data: string; value: string } | null;
  approvalPending?: boolean;
}

// Per-VM dispatch for the native gas cost of a prepared tx, in native wei.
// Tron skipped because its fee model is energy + bandwidth, not gasLimit × gasPrice.
export async function estimateNativeGasCost(
  multiProvider: MultiProtocolProvider,
  args: EstimateGasArgs,
): Promise<bigint> {
  if (!args.tx) return 0n;
  const protocol = multiProvider.tryGetProtocol(args.chainName);
  if (protocol !== ProtocolType.Ethereum) return 0n;
  const { estimateEvmGasCost } = await import('./evm');
  return estimateEvmGasCost(multiProvider, {
    chainName: args.chainName,
    sender: args.sender,
    to: args.tx.to,
    data: args.tx.data,
    value: args.tx.value,
    approvalPending: args.approvalPending,
  });
}
