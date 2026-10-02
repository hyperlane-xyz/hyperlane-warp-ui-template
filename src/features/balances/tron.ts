import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { convertToProtocolAddress, ProtocolType } from '@hyperlane-xyz/utils';
import { decodeFunctionResult, encodeFunctionData, erc20Abi, type Address } from 'viem';

import { logger } from '../../utils/logger';
import type { BalanceToken } from './types';
import { getBalanceTokenKey } from './types';

// Tron balance batcher. wagmi doesn't have a Tron chain so we can't reuse
// fetchEvmChainBalances directly — but MultiProtocolProvider exposes a
// TronJsonRpcProvider (ethers v5) that speaks Tron's EVM-compatible
// JSON-RPC, so we can run plain `eth_call` for each TRC20 balanceOf and
// `getBalance` for native.
//
// One per-token round trip rather than a multicall — Tron's Multicall3 is
// at a non-canonical address (0x32a4F4…) and the parallel call payload is
// small enough that 1 RPC per token via Promise.all stays well within
// trongrid's free-tier limits.
export async function fetchTronChainBalances(
  multiProvider: MultiProtocolProvider,
  tokens: BalanceToken[],
  userAddress: string,
): Promise<Record<string, bigint>> {
  const out: Record<string, bigint> = {};
  if (tokens.length === 0) return out;

  const chainName = tokens[0]?.chainName;
  if (!chainName) return out;

  // Tron wallets give base58 addresses; TRC20 contracts need EVM-hex.
  let ownerHex: Address;
  try {
    ownerHex = convertToProtocolAddress(userAddress, ProtocolType.Ethereum) as Address;
  } catch (err) {
    logger.warn('Failed to convert Tron owner address to EVM hex', err as Error);
    return out;
  }

  let provider: ReturnType<typeof multiProvider.getEthersV5Provider>;
  try {
    provider = multiProvider.getEthersV5Provider(chainName);
  } catch (err) {
    logger.warn(`No Tron provider for chain ${chainName}`, err as Error);
    return out;
  }

  const erc20 = tokens.filter((t) => !t.isNative);
  const native = tokens.filter((t) => t.isNative);

  const erc20Results = await Promise.all(
    erc20.map(async (t) => {
      try {
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [ownerHex],
        });
        const raw = await provider.call({ to: t.address as Address, data });
        const balance = decodeFunctionResult({
          abi: erc20Abi,
          functionName: 'balanceOf',
          data: raw as `0x${string}`,
        }) as bigint;
        return { token: t, balance };
      } catch (err) {
        logger.warn(`TRC20 balanceOf failed for ${t.symbol} on ${chainName}`, err as Error);
        return null;
      }
    }),
  );
  for (const r of erc20Results) {
    if (r) out[getBalanceTokenKey(r.token)] = r.balance;
  }

  if (native.length) {
    try {
      const raw = await provider.getBalance(ownerHex);
      const balance = BigInt(raw.toString());
      for (const t of native) out[getBalanceTokenKey(t)] = balance;
    } catch (err) {
      logger.warn(`Tron native getBalance failed on ${chainName}`, err as Error);
    }
  }

  return out;
}
