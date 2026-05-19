import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import {
  convertToProtocolAddress,
  isEVMLike,
  isValidAddress,
  isZeroishAddress,
  ProtocolType,
} from '@hyperlane-xyz/utils';
import { parseUnits } from 'viem';

import { logger } from '../../utils/logger';
import type { ChainDiscovery } from '../api/types';
import { estimateNativeGasCost, readBalance } from './balances/read';
import type { UiToken } from './tokens/types';
import type { AugmentedRoute, FeeComponent, SwapFormValues } from './types';

const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';

export type SwapFormErrors = Partial<
  Record<
    'amount' | 'recipient' | 'srcChain' | 'dstChain' | 'srcToken' | 'dstToken' | 'form',
    string
  >
>;

// Top-level orchestrator. Mirrors WarpCore.validateTransfer shape.
export async function validateSwapForm(args: {
  values: SwapFormValues;
  bestRoute: AugmentedRoute | undefined;
  srcToken: UiToken | undefined;
  dstToken: UiToken | undefined;
  sender: string | undefined;
  effectiveRecipient: string;
  chains: ChainDiscovery[] | undefined;
  multiProvider: MultiProtocolProvider;
  approvalPending?: boolean;
  quoteExpiresAt?: number;
}): Promise<SwapFormErrors | null> {
  const {
    values,
    bestRoute,
    srcToken,
    dstToken,
    sender,
    effectiveRecipient,
    chains,
    multiProvider,
    approvalPending,
    quoteExpiresAt,
  } = args;

  const chainsResult = validateChains(values, chains);
  if ('error' in chainsResult) return chainsResult.error;
  const { srcChainInfo, dstChainInfo } = chainsResult;

  if (!srcToken) return { srcToken: 'Origin token required' };
  if (!dstToken) return { dstToken: 'Destination token required' };
  if (!sender) return { form: 'Connect a wallet to continue' };

  if (srcToken.chainId !== values.srcChain) {
    return { srcToken: 'Selected token does not match origin chain' };
  }
  if (dstToken.chainId !== values.dstChain) {
    return { dstToken: 'Selected token does not match destination chain' };
  }

  const recipientError = validateRecipient(effectiveRecipient, dstChainInfo, multiProvider);
  if (recipientError) return recipientError;

  const amountResult = validateAmount(values, srcToken);
  if ('error' in amountResult) return amountResult.error;
  const { amountAtomic } = amountResult;

  if (!bestRoute) return null;

  const quoteError = validateQuote({ bestRoute, quoteExpiresAt });
  if (quoteError) return quoteError;

  return validateBalances({
    multiProvider,
    srcChainInfo,
    srcToken,
    sender,
    bestRoute,
    amountAtomic,
    approvalPending,
  });
}

export function validateChains(
  values: SwapFormValues,
  chains: ChainDiscovery[] | undefined,
): { srcChainInfo: ChainDiscovery; dstChainInfo: ChainDiscovery } | { error: SwapFormErrors } {
  if (values.srcChain == null) return { error: { srcChain: 'Origin chain required' } };
  if (values.dstChain == null) return { error: { dstChain: 'Destination chain required' } };
  const srcChainInfo = chains?.find((c) => c.id === values.srcChain);
  const dstChainInfo = chains?.find((c) => c.id === values.dstChain);
  if (!srcChainInfo) return { error: { srcChain: 'Origin chain not supported' } };
  if (!dstChainInfo) return { error: { dstChain: 'Destination chain not supported' } };
  return { srcChainInfo, dstChainInfo };
}

export function validateRecipient(
  recipient: string,
  dstChainInfo: ChainDiscovery,
  multiProvider: MultiProtocolProvider,
): SwapFormErrors | null {
  if (!recipient) {
    return { recipient: 'Enter a recipient or connect a destination wallet' };
  }
  const dstProtocol = dstChainInfo.protocol as ProtocolType;
  if (!isValidAddress(recipient, dstProtocol) || isZeroishAddress(recipient)) {
    return { recipient: 'Invalid recipient address' };
  }
  if (dstProtocol === ProtocolType.Cosmos || dstProtocol === ProtocolType.CosmosNative) {
    const prefix = multiProvider.tryGetChainMetadata(dstChainInfo.chainName)?.bech32Prefix;
    if (prefix && !recipient.startsWith(prefix)) {
      return { recipient: `Recipient must use the ${prefix} prefix` };
    }
  }
  const dstUR = dstChainInfo.universalRouter;
  if (dstUR && isEVMLike(dstProtocol)) {
    const recipientHex = toEvmCanonical(recipient, dstProtocol);
    const urHex = toEvmCanonical(dstUR, ProtocolType.Ethereum);
    if (recipientHex && urHex && recipientHex === urHex) {
      return { recipient: 'Recipient cannot be the Universal Router' };
    }
  }
  return null;
}

export function validateQuote(args: {
  bestRoute: AugmentedRoute;
  quoteExpiresAt: number | undefined;
}): SwapFormErrors | null {
  const { bestRoute, quoteExpiresAt } = args;
  if (quoteExpiresAt != null && quoteExpiresAt * 1000 < Date.now()) {
    return { form: 'Quote has expired — refresh to continue' };
  }
  if (!bestRoute.raw.tx) {
    return { form: 'Route is not executable' };
  }
  return null;
}

export function validateAmount(
  values: SwapFormValues,
  srcToken: UiToken,
): { amountAtomic: bigint } | { error: SwapFormErrors } {
  const amountStr = values.amount?.toString().trim() ?? '';
  if (!amountStr) return { error: { amount: 'Enter an amount' } };
  const amountNum = Number(amountStr);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return { error: { amount: 'Enter a positive amount' } };
  }
  try {
    const a = parseUnits(amountStr, srcToken.decimals);
    if (a <= 0n) return { error: { amount: 'Enter a positive amount' } };
    return { amountAtomic: a };
  } catch {
    return { error: { amount: 'Invalid amount' } };
  }
}

export async function validateBalances(args: {
  multiProvider: MultiProtocolProvider;
  srcChainInfo: ChainDiscovery;
  srcToken: UiToken;
  sender: string;
  bestRoute: AugmentedRoute;
  amountAtomic: bigint;
  approvalPending?: boolean;
}): Promise<SwapFormErrors | null> {
  const {
    multiProvider,
    srcChainInfo,
    srcToken,
    sender,
    bestRoute,
    amountAtomic,
    approvalPending,
  } = args;

  const initialStep = bestRoute.raw.steps[0];
  const amountIn =
    initialStep && 'amountIn' in initialStep ? BigInt(initialStep.amountIn) : amountAtomic;

  const igpByToken = aggregateIgp(bestRoute.feeBreakdown.components);
  const srcKey = balanceKey(srcToken.chainId, srcToken.address);
  const sameTokenIgp = igpByToken.get(srcKey) ?? 0n;

  let srcBalance: bigint | null;
  try {
    srcBalance = await readBalance(multiProvider, {
      chainName: srcChainInfo.chainName,
      tokenAddress: srcToken.address,
      isNative: srcToken.isNative,
      owner: sender,
    });
  } catch (err) {
    logger.warn('Failed to read source balance during validation', err as Error);
    return null;
  }

  if (srcBalance != null && amountIn + sameTokenIgp > srcBalance) {
    return { amount: `Insufficient ${srcToken.symbol} balance` };
  }

  for (const [key, sum] of igpByToken) {
    if (key === srcKey) continue;
    const [chainIdStr, addr = ''] = key.split('-');
    if (isNativeAddress(addr)) continue;
    if (Number(chainIdStr) !== srcChainInfo.id) continue;
    try {
      const bal = await readBalance(multiProvider, {
        chainName: srcChainInfo.chainName,
        tokenAddress: addr,
        isNative: false,
        owner: sender,
      });
      if (bal != null && sum > bal) {
        return { amount: 'Insufficient balance to cover interchain gas fee' };
      }
    } catch (err) {
      logger.warn('Failed to read IGP token balance during validation', err as Error);
    }
  }

  const txValue = bestRoute.raw.tx ? BigInt(bestRoute.raw.tx.value) : 0n;
  const gasCost = await estimateNativeGasCost(multiProvider, {
    chainName: srcChainInfo.chainName,
    sender,
    tx: bestRoute.raw.tx,
    approvalPending,
  });
  const nativeRequired = txValue + gasCost;
  if (nativeRequired > 0n) {
    let nativeBalance: bigint | null = srcToken.isNative ? srcBalance : null;
    if (!srcToken.isNative) {
      try {
        nativeBalance = await readBalance(multiProvider, {
          chainName: srcChainInfo.chainName,
          tokenAddress: NATIVE_ADDRESS,
          isNative: true,
          owner: sender,
        });
      } catch (err) {
        logger.warn('Failed to read native balance during validation', err as Error);
        return null;
      }
    }
    if (nativeBalance != null && nativeRequired > nativeBalance) {
      const sym = srcChainInfo.nativeCurrency?.symbol ?? 'native';
      return { amount: `Insufficient ${sym} for transaction value and gas` };
    }
  }

  return null;
}

function aggregateIgp(components: FeeComponent[]): Map<string, bigint> {
  const map = new Map<string, bigint>();
  for (const c of components) {
    if (c.category !== 'igp') continue;
    const k = balanceKey(c.chainId, c.tokenAddress);
    map.set(k, (map.get(k) ?? 0n) + c.amount);
  }
  return map;
}

function balanceKey(chainId: number, address: string): string {
  return `${chainId}-${address.toLowerCase()}`;
}

function isNativeAddress(addr: string): boolean {
  return /^0x0+$/i.test(addr);
}

function toEvmCanonical(addr: string, protocol: ProtocolType): string | null {
  try {
    const hex =
      protocol === ProtocolType.Ethereum
        ? addr
        : convertToProtocolAddress(addr, ProtocolType.Ethereum);
    return hex.toLowerCase();
  } catch {
    return null;
  }
}
