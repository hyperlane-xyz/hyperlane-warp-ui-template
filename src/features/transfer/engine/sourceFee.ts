import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { formatError, type HexString, isEVMLike, ProtocolType } from '@hyperlane-xyz/utils';

import { getRouteTxs } from '../../api/routeTx';
import type { RouteResponse } from '../../api/types';
import { prepareRouteTransaction } from './routeTransactions';
import type { FeeBreakdown } from './types';

const EVM_LIKE_MIN_ROUTE_GAS_UNITS = 600_000n;
const EVM_LIKE_APPROVAL_GAS_UNITS = 55_000n;
const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';

export function sourceFeeRouteKey(route: RouteResponse): string {
  return JSON.stringify([
    route.tx ?? null,
    route.txs ?? null,
    route.gas.originGas,
    route.sourceTransactionFee ?? null,
  ]);
}

export function withEstimatedSourceFee(
  feeBreakdown: FeeBreakdown,
  sourceFee: bigint | undefined,
  sourceChain: number | undefined,
): FeeBreakdown {
  if (sourceFee == null || sourceChain == null) return feeBreakdown;
  const components = feeBreakdown.components.filter(
    (component) => component.category !== 'localGas',
  );
  if (sourceFee > 0n) {
    components.push({
      category: 'localGas',
      amount: sourceFee,
      chainId: sourceChain,
      tokenAddress: NATIVE_ADDRESS,
    });
  }
  return { ...feeBreakdown, components };
}

export async function estimateRouteSourceFee({
  multiProvider,
  chainName,
  sender,
  senderPubKey,
  route,
  approvalTransactionCount,
}: {
  multiProvider: MultiProtocolProvider;
  chainName: string;
  sender: string;
  senderPubKey?: Promise<HexString | undefined> | HexString;
  route: RouteResponse;
  approvalTransactionCount: number;
}): Promise<bigint> {
  if (route.sourceTransactionFee && approvalTransactionCount === 0) {
    return BigInt(route.sourceTransactionFee.amount);
  }

  const protocol = multiProvider.tryGetProtocol(chainName);
  if (!protocol) throw new Error(`Unknown source protocol for ${chainName}`);

  if (route.sourceTransactionFee && !isEVMLike(protocol)) {
    return BigInt(route.sourceTransactionFee.amount);
  }

  // Starknet requires its connected account for estimation and remains on the
  // existing account.estimateInvokeFee path in TransferForm.
  if (protocol === ProtocolType.Starknet) return 0n;

  const routeTxs = getRouteTxs(route);
  const approvalCount = Math.max(
    approvalTransactionCount,
    embeddedApprovalTransactionCount(routeTxs),
  );
  if (isEVMLike(protocol) && approvalCount > 0) {
    return estimateEvmLikeFeeForGasUnits(
      multiProvider,
      chainName,
      evmLikeRouteGasUnits(route, approvalCount),
    );
  }

  const transactions = await prepareSourceTransactions({
    multiProvider,
    chainName,
    protocol,
    sender,
    routeTxs,
  });
  const publicKey = (await senderPubKey)?.replace(/^0x/, '');
  try {
    const estimates = await Promise.all(
      transactions.map((transaction) =>
        multiProvider.estimateTransactionFee({
          chainNameOrId: chainName,
          transaction,
          sender,
          senderPubKey: publicKey,
          // Fee estimation must succeed even when validation is about to prove
          // that the sender cannot afford the transaction.
          ignoreSenderBalance: true,
        }),
      ),
    );
    return estimates.reduce((sum, estimate) => sum + BigInt(estimate.fee), 0n);
  } catch (error) {
    if (!isEVMLike(protocol)) throw error;
    // KiiChain-style RPCs reject the balance state-override argument, so fall
    // back to the quote's raw origin gas budget for the whole estimate.
    if (isUnsupportedStateOverrideError(error)) {
      return estimateEvmLikeFeeForGasUnits(multiProvider, chainName, BigInt(route.gas.originGas));
    }
    // A synthetic/collateral transferRemote reverts in estimateGas when the
    // sender does not yet hold the token to burn or transfer. The balance
    // override only funds native gas, not the ERC20 balance, so on EVM-like
    // chains fall back to the quote's origin gas budget instead of surfacing a
    // fee-estimate error for an otherwise valid quote. Separate transfer
    // validation still blocks the send. Non-revert errors keep propagating so
    // real estimation failures stay visible.
    if (isExecutionRevertError(error)) {
      return estimateEvmLikeFeeForGasUnits(
        multiProvider,
        chainName,
        evmLikeRouteGasUnits(route, approvalCount),
      );
    }
    throw error;
  }
}

function isUnsupportedStateOverrideError(error: unknown): boolean {
  return formatError(error).toLowerCase().includes('too many arguments, want at most 2');
}

function evmLikeRouteGasUnits(route: RouteResponse, approvalCount: number): bigint {
  const routeGasUnits = BigInt(route.gas.originGas);
  return (
    (routeGasUnits > EVM_LIKE_MIN_ROUTE_GAS_UNITS ? routeGasUnits : EVM_LIKE_MIN_ROUTE_GAS_UNITS) +
    BigInt(approvalCount) * EVM_LIKE_APPROVAL_GAS_UNITS
  );
}

function isExecutionRevertError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const record = current as Record<string, unknown>;
    const code = record.code;
    if (
      code === 'UNPREDICTABLE_GAS_LIMIT' ||
      code === 'CALL_EXCEPTION' ||
      code === 3 ||
      code === '3'
    ) {
      return true;
    }
    for (const key of ['message', 'reason', 'body'] as const) {
      const value = record[key];
      if (typeof value === 'string' && value.toLowerCase().includes('execution reverted')) {
        return true;
      }
    }
    current = record.error ?? record.cause;
  }
  return false;
}

async function estimateEvmLikeFeeForGasUnits(
  multiProvider: MultiProtocolProvider,
  chainName: string,
  gasUnits: bigint,
): Promise<bigint> {
  const feeData = await multiProvider.getEthersV5Provider(chainName).getFeeData();
  const maxFee = feeData.maxFeePerGas != null ? BigInt(feeData.maxFeePerGas.toString()) : undefined;
  const legacyFee = feeData.gasPrice != null ? BigInt(feeData.gasPrice.toString()) : undefined;
  const gasPrice = maxFee ?? legacyFee;
  if (gasPrice == null) throw new Error(`No EVM-like gas price available for ${chainName}`);
  return gasUnits * gasPrice;
}

function embeddedApprovalTransactionCount(routeTxs: ReturnType<typeof getRouteTxs>): number {
  const explicitCount = routeTxs.filter(
    (tx) => 'category' in tx && (tx.category === 'approval' || tx.category === 'revoke'),
  ).length;
  return explicitCount || Math.max(0, routeTxs.length - 1);
}

async function prepareSourceTransactions({
  multiProvider,
  chainName,
  protocol,
  sender,
  routeTxs,
}: {
  multiProvider: MultiProtocolProvider;
  chainName: string;
  protocol: ProtocolType;
  sender: string;
  routeTxs: ReturnType<typeof getRouteTxs>;
}) {
  if (!routeTxs.length) throw new Error('Route has no source transaction');

  return Promise.all(
    routeTxs.map((routeTx) =>
      prepareRouteTransaction(routeTx, {
        protocol,
        sender,
        chainName,
        multiProvider,
      }),
    ),
  );
}
