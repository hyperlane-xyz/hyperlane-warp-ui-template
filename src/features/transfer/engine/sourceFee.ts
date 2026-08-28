import { type MultiProtocolProvider, TokenStandard } from '@hyperlane-xyz/sdk';
import { formatError, type HexString, isEVMLike, ProtocolType } from '@hyperlane-xyz/utils';

import { getRouteTxs } from '../../api/routeTx';
import type { RouteResponse } from '../../api/types';
import { prepareRouteTransaction } from './routeTransactions';
import type { FeeBreakdown } from './types';

const EVM_LIKE_MIN_ROUTE_GAS_UNITS = 600_000n;
const EVM_LIKE_APPROVAL_GAS_UNITS = 55_000n;
const ERC20_INSUFFICIENT_BALANCE_SELECTOR = '0xe450d38c';
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
  sourceTokenStandard,
  route,
  approvalTransactionCount,
}: {
  multiProvider: MultiProtocolProvider;
  chainName: string;
  sender: string;
  senderPubKey?: Promise<HexString | undefined> | HexString;
  sourceTokenStandard?: TokenStandard;
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
    const routeGasUnits = BigInt(route.gas.originGas);
    const gasUnits =
      (routeGasUnits > EVM_LIKE_MIN_ROUTE_GAS_UNITS
        ? routeGasUnits
        : EVM_LIKE_MIN_ROUTE_GAS_UNITS) +
      BigInt(approvalCount) * EVM_LIKE_APPROVAL_GAS_UNITS;
    return estimateEvmLikeFeeForGasUnits(multiProvider, chainName, gasUnits);
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
    if (isEVMLike(protocol) && shouldUseQuotedGasFallback(error, sourceTokenStandard)) {
      return estimateEvmLikeFeeForGasUnits(multiProvider, chainName, BigInt(route.gas.originGas));
    }
    throw error;
  }
}

function shouldUseQuotedGasFallback(error: unknown, sourceTokenStandard?: TokenStandard): boolean {
  const message = formatError(error).toLowerCase();
  const isSyntheticStandard =
    sourceTokenStandard === TokenStandard.EvmHypSynthetic ||
    sourceTokenStandard === TokenStandard.EvmHypSyntheticRebase;
  const isInsufficientBurnBalance =
    message.includes('burn amount exceeds balance') ||
    errorContainsText(error, ERC20_INSUFFICIENT_BALANCE_SELECTOR);
  return (
    message.includes('too many arguments, want at most 2') ||
    // A native balance override cannot fund synthetic token storage. Match
    // both OpenZeppelin v4's revert string and v5's custom error selector.
    (isSyntheticStandard && isInsufficientBurnBalance)
  );
}

function errorContainsText(error: unknown, text: string, depth = 0): boolean {
  if (typeof error === 'string') return error.toLowerCase().includes(text);
  if (depth >= 6 || typeof error !== 'object' || error === null) return false;

  const message = Reflect.get(error, 'message');
  if (typeof message === 'string' && message.toLowerCase().includes(text)) return true;

  return ['error', 'cause', 'data'].some((field) =>
    errorContainsText(Reflect.get(error, field), text, depth + 1),
  );
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
