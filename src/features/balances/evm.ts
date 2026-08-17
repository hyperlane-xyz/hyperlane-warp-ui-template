import {
  EvmNativeTokenAdapter,
  EvmTokenAdapter,
  type MultiProtocolProvider,
} from '@hyperlane-xyz/sdk';
import { type Address, erc20Abi, type PublicClient } from 'viem';

import { logger } from '../../utils/logger';
import type { BalanceToken } from './types';
import { getBalanceTokenKey } from './types';

// Canonical multicall3 address, deployed at this address on most EVM
// chains. Chains that put multicall3 elsewhere should pass their
// override via `multicallAddress` (registry chainMetadata.batchContractAddress).
const DEFAULT_MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

// Per-chain EVM balance batcher. Splits the input into native + ERC20,
// runs one multicall for ERC20 balanceOf and a single getBalance for
// native, and returns a getBalanceTokenKey-keyed map of bigints. Caller is
// responsible for filtering input to a single EVM chain.
export async function fetchEvmChainBalances(
  client: PublicClient,
  tokens: BalanceToken[],
  userAddress: Address,
  multicallAddress?: Address,
): Promise<Record<string, bigint>> {
  const out: Record<string, bigint> = {};
  if (tokens.length === 0) return out;

  const erc20 = tokens.filter((t) => !t.isNative);
  const native = tokens.filter((t) => t.isNative);

  if (erc20.length) {
    try {
      const results = await client.multicall({
        multicallAddress: (multicallAddress ?? DEFAULT_MULTICALL3_ADDRESS) as Address,
        contracts: erc20.map((t) => ({
          address: t.address as Address,
          abi: erc20Abi,
          functionName: 'balanceOf' as const,
          args: [userAddress] as const,
        })),
      });
      const failedTokens: BalanceToken[] = [];
      erc20.forEach((t, i) => {
        const r = results[i];
        if (r.status === 'success') out[getBalanceTokenKey(t)] = r.result as bigint;
        else failedTokens.push(t);
      });
      if (failedTokens.length)
        await readErc20BalancesIndividually(client, failedTokens, userAddress, out);
    } catch (err) {
      logger.warn(
        'multicall balanceOf failed; falling back to individual ERC20 reads',
        err as Error,
      );
      await readErc20BalancesIndividually(client, erc20, userAddress, out);
    }
  }

  if (native.length) {
    try {
      const balance = await client.getBalance({ address: userAddress });
      for (const t of native) out[getBalanceTokenKey(t)] = balance;
    } catch (err) {
      logger.warn('native getBalance failed', err as Error);
    }
  }

  return out;
}

async function readErc20BalancesIndividually(
  client: PublicClient,
  tokens: BalanceToken[],
  userAddress: Address,
  out: Record<string, bigint>,
): Promise<void> {
  await Promise.all(
    tokens.map(async (t) => {
      try {
        out[getBalanceTokenKey(t)] = (await client.readContract({
          address: t.address as Address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [userAddress],
        })) as bigint;
      } catch (readErr) {
        logger.warn(`balanceOf failed for ${t.symbol} on ${t.chainName}`, readErr as Error);
      }
    }),
  );
}

// Single-balance read for the form validator on the Continue path.
// Uses the SDK's base token adapters (NOT HypTokenAdapter).
export async function readEvmBalance(
  multiProvider: MultiProtocolProvider,
  args: { chainName: string; tokenAddress: string; isNative: boolean; owner: string },
): Promise<bigint> {
  const { chainName, tokenAddress, isNative, owner } = args;
  if (isNative || isZeroAddress(tokenAddress)) {
    return new EvmNativeTokenAdapter(chainName, multiProvider, {}).getBalance(owner);
  }
  return new EvmTokenAdapter(chainName, multiProvider, { token: tokenAddress }).getBalance(owner);
}

function isZeroAddress(addr: string): boolean {
  return /^0x0+$/i.test(addr);
}
