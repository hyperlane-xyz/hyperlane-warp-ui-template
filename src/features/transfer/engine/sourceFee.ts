import { type MultiProtocolProvider, type TypedTransaction } from '@hyperlane-xyz/sdk';
import { type HexString, isEVMLike, ProtocolType } from '@hyperlane-xyz/utils';

import { getRouteTxs } from '../../api/routeTx';
import type { RouteResponse } from '../../api/types';
import { prepareRouteTransaction } from './routeTransactions';

const EVM_LIKE_MIN_ROUTE_GAS_UNITS = 600_000n;
const EVM_LIKE_APPROVAL_GAS_UNITS = 55_000n;

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
  const protocol = multiProvider.tryGetProtocol(chainName);
  if (!protocol) throw new Error(`Unknown source protocol for ${chainName}`);

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
    protocol: protocol as ProtocolType,
    sender,
    routeTxs,
  });
  const publicKey = (await senderPubKey)?.replace(/^0x/, '');
  const estimates = await Promise.all(
    transactions.map((transaction) =>
      multiProvider.estimateTransactionFee({
        chainNameOrId: chainName,
        transaction,
        sender,
        senderPubKey: publicKey,
      }),
    ),
  );

  return estimates.reduce((sum, estimate) => sum + BigInt(estimate.fee), 0n);
}

async function estimateEvmLikeFeeForGasUnits(
  multiProvider: MultiProtocolProvider,
  chainName: string,
  gasUnits: bigint,
): Promise<bigint> {
  const feeData = await multiProvider.getEthersV5Provider(chainName).getFeeData();
  const maxFee = feeData.maxFeePerGas ? BigInt(feeData.maxFeePerGas.toString()) : undefined;
  const legacyFee = feeData.gasPrice ? BigInt(feeData.gasPrice.toString()) : undefined;
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
}): Promise<TypedTransaction[]> {
  if (!routeTxs.length) throw new Error('Route has no source transaction');

  const rpcUrl = multiProvider.tryGetChainMetadata(chainName)?.rpcUrls?.[0]?.http;
  const routeTransactions = await Promise.all(
    routeTxs.map((routeTx) =>
      prepareRouteTransaction(routeTx, {
        protocol,
        sender,
        rpcUrl,
      }),
    ),
  );
  return routeTransactions;
}
