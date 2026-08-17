import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { isEVMLike, ProtocolType } from '@hyperlane-xyz/utils';

import { readAleoTokenBalance } from './aleo';
import { readCosmosTokenBalance } from './cosmos';
import { estimateEvmGasCostForUnits, readEvmBalance } from './evm';
import { readRadixTokenBalance } from './radix';
import { readSealevelTokenBalance } from './sealevel';
import { readStarknetTokenBalance } from './starknet';

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
  if (isEVMLike(protocol)) return readEvmBalance(multiProvider, args);
  if (protocol === ProtocolType.Sealevel) return readSealevelTokenBalance(multiProvider, args);
  if (protocol === ProtocolType.Starknet) return readStarknetTokenBalance(multiProvider, args);
  if (protocol === ProtocolType.Cosmos || protocol === ProtocolType.CosmosNative) {
    return readCosmosTokenBalance(multiProvider, args);
  }
  if (protocol === ProtocolType.Radix) return readRadixTokenBalance(multiProvider, args);
  if (protocol === ProtocolType.Aleo) return readAleoTokenBalance(multiProvider, args);
  return null;
}

export async function estimateNativeGasCostForUnits(
  multiProvider: MultiProtocolProvider,
  args: { chainName: string; gasUnits: bigint },
): Promise<bigint> {
  const protocol = multiProvider.tryGetProtocol(args.chainName);
  if (protocol !== ProtocolType.Ethereum) return 0n;
  return estimateEvmGasCostForUnits(multiProvider, args);
}
