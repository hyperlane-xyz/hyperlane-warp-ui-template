import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import {
  convertToProtocolAddress,
  isEVMLike,
  isValidAddress,
  isZeroishAddress,
  normalizeAddressEvm,
  ProtocolType,
} from '@hyperlane-xyz/utils';
import { parseUnits } from 'viem';

import { logger } from '../../../utils/logger';
import { getRouteTxs, isChainRouteTx, toEvmRouteTx } from '../../api/routeTx';
import type { ChainDiscovery } from '../../api/types';
import { estimateNativeGasCost, readBalance } from '../../balances/read';
import { formatDisplayAmount } from '../../balances/utils';
import { isChainDisabled } from '../../chains/utils';
import type { UiToken } from '../../tokens/types';
import { tokenKey } from '../../tokens/utils';
import {
  getRegistryWarpRoute,
  isVaultCollateralWarpStandard,
  type RegistryWarpRouteMap,
} from '../../warpRoutes/registryWarpRoutes';
import type { AugmentedRoute, FeeComponent, TransferFormValues } from './types';

const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';

export type TransferFormErrors = Partial<
  Record<
    'amount' | 'recipient' | 'srcChain' | 'dstChain' | 'srcToken' | 'dstToken' | 'form',
    string
  >
>;

// Top-level validation orchestrator for quote execution.
export async function validateTransferForm(args: {
  values: TransferFormValues;
  bestRoute: AugmentedRoute | undefined;
  srcToken: UiToken | undefined;
  dstToken: UiToken | undefined;
  sender: string | undefined;
  effectiveRecipient: string;
  chains: ChainDiscovery[] | undefined;
  multiProvider: MultiProtocolProvider;
  approvalPending?: boolean;
  quoteExpiresAt?: number;
  nativeExecutionFee?: bigint;
  registryWarpRoutes?: RegistryWarpRouteMap;
}): Promise<TransferFormErrors | null> {
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
    nativeExecutionFee,
    registryWarpRoutes,
  } = args;

  const chainsResult = validateChains(values, chains, multiProvider);
  if (!chainsResult.ok) return chainsResult.error;
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
  if (!amountResult.ok) return amountResult.error;
  const { amountAtomic } = amountResult;

  if (!bestRoute) return null;

  const quoteError = validateQuote({ bestRoute, quoteExpiresAt, amountAtomic });
  if (quoteError) return quoteError;

  return validateBalances({
    multiProvider,
    srcChainInfo,
    srcToken,
    sender,
    bestRoute,
    amountAtomic,
    approvalPending,
    nativeExecutionFee,
    registryWarpRoutes,
  });
}

export type ValidateChainsResult =
  | { ok: true; srcChainInfo: ChainDiscovery; dstChainInfo: ChainDiscovery }
  | { ok: false; error: TransferFormErrors };

export function validateChains(
  values: TransferFormValues,
  chains: ChainDiscovery[] | undefined,
  multiProvider?: MultiProtocolProvider,
): ValidateChainsResult {
  if (values.srcChain == null) return { ok: false, error: { srcChain: 'Origin chain required' } };
  if (values.dstChain == null)
    return { ok: false, error: { dstChain: 'Destination chain required' } };
  const srcChainInfo = chains?.find((c) => c.id === values.srcChain);
  const dstChainInfo = chains?.find((c) => c.id === values.dstChain);
  if (!srcChainInfo) return { ok: false, error: { srcChain: 'Origin chain not supported' } };
  if (!dstChainInfo) return { ok: false, error: { dstChain: 'Destination chain not supported' } };
  if (multiProvider) {
    if (isEngineChainDisabled(srcChainInfo, multiProvider)) {
      return { ok: false, error: { srcChain: 'Origin chain unavailable' } };
    }
    if (isEngineChainDisabled(dstChainInfo, multiProvider)) {
      return { ok: false, error: { dstChain: 'Destination chain unavailable' } };
    }
  }
  return { ok: true, srcChainInfo, dstChainInfo };
}

function isEngineChainDisabled(
  chainInfo: ChainDiscovery,
  multiProvider: MultiProtocolProvider,
): boolean {
  return isChainDisabled(multiProvider.tryGetChainMetadata(chainInfo.chainName) ?? null);
}

export function validateRecipient(
  recipient: string,
  dstChainInfo: ChainDiscovery,
  multiProvider: MultiProtocolProvider,
): TransferFormErrors | null {
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
  amountAtomic?: bigint;
}): TransferFormErrors | null {
  const { bestRoute, quoteExpiresAt, amountAtomic } = args;
  if (quoteExpiresAt != null && quoteExpiresAt * 1000 < Date.now()) {
    return { form: 'Quote has expired — refresh to continue' };
  }
  if (!getRouteTxs(bestRoute.raw).length) {
    return { form: 'Route is not executable' };
  }
  if (amountAtomic != null) {
    const initialStep = bestRoute.raw.steps[0];
    if (initialStep) {
      try {
        if (BigInt(initialStep.amountIn) !== amountAtomic) {
          return { form: 'Quote amount is stale — refresh to continue' };
        }
      } catch {
        return { form: 'Route is not executable' };
      }
    }
  }
  return null;
}

export type ValidateAmountResult =
  | { ok: true; amountAtomic: bigint }
  | { ok: false; error: TransferFormErrors };

export function validateAmount(
  values: TransferFormValues,
  srcToken: UiToken,
): ValidateAmountResult {
  const amountStr = values.amount?.toString().trim() ?? '';
  if (!amountStr) return { ok: false, error: { amount: 'Enter an amount' } };
  const amountNum = Number(amountStr);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return { ok: false, error: { amount: 'Enter a positive amount' } };
  }
  try {
    const a = parseUnits(amountStr, srcToken.decimals);
    if (a <= 0n) return { ok: false, error: { amount: 'Enter a positive amount' } };
    return { ok: true, amountAtomic: a };
  } catch {
    return { ok: false, error: { amount: 'Invalid amount' } };
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
  nativeExecutionFee?: bigint;
  registryWarpRoutes?: RegistryWarpRouteMap;
}): Promise<TransferFormErrors | null> {
  const {
    multiProvider,
    srcChainInfo,
    srcToken,
    sender,
    bestRoute,
    amountAtomic,
    approvalPending,
    nativeExecutionFee = 0n,
    registryWarpRoutes = {},
  } = args;

  const initialStep = bestRoute.raw.steps[0];
  const amountIn =
    initialStep && 'amountIn' in initialStep ? BigInt(initialStep.amountIn) : amountAtomic;

  const igpByToken = aggregateIgp(bestRoute.feeBreakdown.components);
  const srcKey = balanceKey(srcToken.chainId, srcToken.address);
  const sameTokenIgp = igpByToken.get(srcKey) ?? 0n;
  const nativeFee = igpByToken.get(balanceKey(srcChainInfo.id, NATIVE_ADDRESS)) ?? 0n;

  let srcBalance: bigint | null;
  try {
    srcBalance = await readBalance(multiProvider, {
      chainName: srcChainInfo.chainName,
      tokenAddress: srcToken.address,
      isNative: srcToken.isNative,
      owner: sender,
      standard: srcToken.standard,
      decimals: srcToken.decimals,
      symbol: srcToken.symbol,
      name: srcToken.name,
      coinGeckoId: srcToken.coinGeckoId,
      logoURI: srcToken.logoURI,
    });
  } catch (err) {
    logger.warn('Failed to read source balance during validation', err as Error);
    return null;
  }

  if (srcBalance != null && amountIn + sameTokenIgp > srcBalance) {
    return {
      amount: formatInsufficientBalanceMessage({
        base: `Insufficient ${srcToken.symbol} balance`,
        deficit: amountIn + sameTokenIgp - srcBalance,
        decimals: srcToken.decimals,
        symbol: srcToken.symbol,
      }),
    };
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

  const routeTxs = getRouteTxs(bestRoute.raw);
  const directOriginTx = routeTxs.find(isChainRouteTx);
  const originTxs = directOriginTx
    ? [{ to: directOriginTx.to, data: directOriginTx.data, value: directOriginTx.value }]
    : isVaultSdkRoute(bestRoute, srcChainInfo.chainName, registryWarpRoutes)
      ? routeTxs.map(toEvmRouteTx).filter(isNotNull)
      : [];
  const txValue = originTxs.reduce((sum, tx) => sum + BigInt(tx.value), 0n);
  const gasCosts = await Promise.all(
    originTxs.map(({ category: _category, ...tx }, index) => {
      const hasPriorApproval = originTxs
        .slice(0, index)
        .some((priorTx) => priorTx.category === 'approval' || priorTx.category === 'revoke');
      return estimateNativeGasCost(multiProvider, {
        chainName: srcChainInfo.chainName,
        sender,
        tx,
        approvalPending: hasPriorApproval ? true : approvalPending,
      });
    }),
  );
  const gasCost = gasCosts.reduce((sum, cost) => sum + cost, 0n);
  const quotedNativeDebit = srcToken.isNative ? amountIn + sameTokenIgp : nativeFee;
  const nativeRequired = maxBigInt(txValue, quotedNativeDebit) + gasCost + nativeExecutionFee;
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
      return {
        amount: formatInsufficientBalanceMessage({
          base: `Insufficient ${sym} for transaction value and gas`,
          deficit: nativeRequired - nativeBalance,
          decimals: srcChainInfo.nativeCurrency?.decimals ?? 18,
          symbol: sym,
        }),
      };
    }
  }

  return null;
}

function maxBigInt(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

function isNotNull<T>(value: T | null): value is T {
  return value != null;
}

function isVaultSdkRoute(
  route: AugmentedRoute,
  originChainName: string,
  registryWarpRoutes: RegistryWarpRouteMap,
): boolean {
  if (route.raw.executionKind !== 'sdkWarp') return false;
  const routeId =
    route.raw.connection?.warpRouteId ??
    route.raw.steps.find((step) => step.type === 'bridge')?.warpRouteId;
  if (!routeId) return false;
  const registryRoute = getRegistryWarpRoute(registryWarpRoutes, routeId);
  const origin = registryRoute?.tokens.find((token) => token.chainName === originChainName);
  return !!origin && isVaultCollateralWarpStandard(origin.standard);
}

function formatInsufficientBalanceMessage({
  base,
  deficit,
  decimals,
  symbol,
}: {
  base: string;
  deficit: bigint;
  decimals: number;
  symbol: string;
}): string {
  return `${base} (need ${formatDisplayAmount(deficit, decimals)} more ${symbol})`;
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
  return tokenKey(chainId, address);
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
    return normalizeAddressEvm(hex);
  } catch {
    return null;
  }
}
