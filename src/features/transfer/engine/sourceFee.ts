import { type MultiProtocolProvider, type TypedTransaction } from '@hyperlane-xyz/sdk';
import { type HexString, isEVMLike, ProtocolType } from '@hyperlane-xyz/utils';

import { getRouteTxs } from '../../api/routeTx';
import type { RouteResponse } from '../../api/types';
import { prepareRouteTransaction } from './routeTransactions';

const EVM_LIKE_APPROVAL_ROUTE_GAS_BUDGET = 600_000n;

export async function estimateRouteSourceFee({
  multiProvider,
  chainName,
  sender,
  senderPubKey,
  route,
  approvalPending,
}: {
  multiProvider: MultiProtocolProvider;
  chainName: string;
  sender: string;
  senderPubKey?: Promise<HexString | undefined> | HexString;
  route: RouteResponse;
  approvalPending: boolean;
}): Promise<bigint> {
  const protocol = multiProvider.tryGetProtocol(chainName);
  if (!protocol) throw new Error(`Unknown source protocol for ${chainName}`);

  // Starknet requires its connected account for estimation and remains on the
  // existing account.estimateInvokeFee path in TransferForm.
  if (protocol === ProtocolType.Starknet) return 0n;

  // A pending approval, including SDK routes that carry approval + transfer
  // transactions, makes the transfer impossible to simulate against current
  // state. Preserve the existing combined gas budget for those routes.
  const routeTxs = getRouteTxs(route);
  if (isEVMLike(protocol) && (approvalPending || routeTxs.length > 1)) {
    return estimateEvmLikeFeeForGasUnits(
      multiProvider,
      chainName,
      EVM_LIKE_APPROVAL_ROUTE_GAS_BUDGET,
    );
  }

  const transactions = await prepareSourceTransactions({
    multiProvider,
    chainName,
    protocol: protocol as ProtocolType,
    sender,
    routeTxs,
  });
  const publicKey = await senderPubKey;
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
  const priorityFee = feeData.maxPriorityFeePerGas
    ? BigInt(feeData.maxPriorityFeePerGas.toString())
    : undefined;
  const legacyFee = feeData.gasPrice ? BigInt(feeData.gasPrice.toString()) : undefined;
  const gasPrice = maxFee && priorityFee ? maxFee + priorityFee : legacyFee;
  if (gasPrice == null) throw new Error(`No EVM-like gas price available for ${chainName}`);
  return gasUnits * gasPrice;
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
