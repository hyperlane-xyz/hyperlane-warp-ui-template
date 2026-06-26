import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { isEVMLike, ProtocolType } from '@hyperlane-xyz/utils';

import { estimateEvmGasCost, readEvmBalance } from './evm';
import { readSolanaTokenBalance } from './solana';

export interface ReadBalanceArgs {
  chainName: string;
  tokenAddress: string;
  isNative: boolean;
  owner: string;
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
  if (isEVMLike(protocol)) return readEvmBalance(multiProvider, args);
  if (protocol === ProtocolType.Sealevel) {
    const rpcUrl = multiProvider.tryGetChainMetadata(args.chainName)?.rpcUrls?.[0]?.http;
    if (!rpcUrl) return null;
    return readSolanaTokenBalance({
      tokenAddress: args.tokenAddress,
      isNative: args.isNative,
      ownerAddress: args.owner,
      rpcUrl,
    });
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
  return estimateEvmGasCost(multiProvider, {
    chainName: args.chainName,
    sender: args.sender,
    to: args.tx.to,
    data: args.tx.data,
    value: args.tx.value,
    approvalPending: args.approvalPending,
  });
}
