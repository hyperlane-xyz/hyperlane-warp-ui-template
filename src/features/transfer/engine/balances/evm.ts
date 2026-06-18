import {
  EvmNativeTokenAdapter,
  EvmTokenAdapter,
  type MultiProtocolProvider,
} from '@hyperlane-xyz/sdk';
import { isNullish } from '@hyperlane-xyz/utils';
import { type Address, erc20Abi, type PublicClient } from 'viem';

import { logger } from '../../../../utils/logger';
import type { UiToken } from '../tokens/types';
import { getTokenKey } from '../tokens/utils';

// Canonical multicall3 address, deployed at this address on most EVM
// chains. Chains that put multicall3 elsewhere should pass their
// override via `multicallAddress` (registry chainMetadata.batchContractAddress).
const DEFAULT_MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

// Per-chain EVM balance batcher. Splits the input into native + ERC20,
// runs one multicall for ERC20 balanceOf and a single getBalance for
// native, and returns a getTokenKey-keyed map of bigints. Caller is
// responsible for filtering input to a single EVM chain.
export async function fetchEvmChainBalances(
  client: PublicClient,
  tokens: UiToken[],
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
      const failedTokens: UiToken[] = [];
      erc20.forEach((t, i) => {
        const r = results[i];
        if (r.status === 'success') out[getTokenKey(t)] = r.result as bigint;
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
      for (const t of native) out[getTokenKey(t)] = balance;
    } catch (err) {
      logger.warn('native getBalance failed', err as Error);
    }
  }

  return out;
}

async function readErc20BalancesIndividually(
  client: PublicClient,
  tokens: UiToken[],
  userAddress: Address,
  out: Record<string, bigint>,
): Promise<void> {
  await Promise.all(
    tokens.map(async (t) => {
      try {
        out[getTokenKey(t)] = (await client.readContract({
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

const PENDING_APPROVAL_GAS_BUDGET = 600_000n;

// gasLimit × gasPrice for a prepared EVM tx, in native wei. Returns 0n
// on failure — caller treats that as "no gas headroom info".
export async function estimateEvmGasCost(
  multiProvider: MultiProtocolProvider,
  args: {
    chainName: string;
    sender: string;
    to: string;
    data: string;
    value: string;
    approvalPending?: boolean;
  },
): Promise<bigint> {
  try {
    const { chainName, sender, to, data, value, approvalPending } = args;
    const provider = multiProvider.getEthersV5Provider(chainName);

    const feeDataPromise = provider.getFeeData();
    const gasUnits = approvalPending
      ? PENDING_APPROVAL_GAS_BUDGET
      : BigInt((await provider.estimateGas({ from: sender, to, data, value })).toString());
    const feeData = await feeDataPromise;
    const maxFee = feeData.maxFeePerGas ? BigInt(feeData.maxFeePerGas.toString()) : undefined;
    const priorityFee = feeData.maxPriorityFeePerGas
      ? BigInt(feeData.maxPriorityFeePerGas.toString())
      : undefined;
    const legacy = feeData.gasPrice ? BigInt(feeData.gasPrice.toString()) : undefined;
    const effectiveGasPrice =
      !isNullish(maxFee) && !isNullish(priorityFee) ? maxFee + priorityFee : legacy;
    if (isNullish(effectiveGasPrice)) return 0n;
    return gasUnits * effectiveGasPrice;
  } catch (err) {
    logger.warn('estimateEvmGasCost failed', err as Error);
    return 0n;
  }
}

function isZeroAddress(addr: string): boolean {
  return /^0x0+$/i.test(addr);
}
