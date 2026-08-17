import { type MultiProtocolProvider, type TypedTransaction } from '@hyperlane-xyz/sdk';
import { type HexString, isEVMLike, ProtocolType } from '@hyperlane-xyz/utils';
import type { UseAccountResult } from '@starknet-react/core';

import { logger } from '../../../utils/logger';
import { getRouteTxs } from '../../api/routeTx';
import type { RouteResponse } from '../../api/types';
import { NATIVE_ADDRESS } from './routeFunding';
import { prepareApprovalTransaction, prepareRouteTransaction } from './routeTransactions';
import type { FeeBreakdown } from './types';

const EVM_LIKE_APPROVAL_ROUTE_GAS_BUDGET = 600_000n;

export async function estimateRouteSourceFee({
  multiProvider,
  chainName,
  sender,
  senderPubKey,
  route,
  approvalAmounts,
}: {
  multiProvider: MultiProtocolProvider;
  chainName: string;
  sender: string;
  senderPubKey?: Promise<HexString | undefined> | HexString;
  route: RouteResponse;
  approvalAmounts: bigint[];
}): Promise<bigint> {
  const protocol = multiProvider.tryGetProtocol(chainName);
  if (!protocol) throw new Error(`Unknown source protocol for ${chainName}`);
  const transactions = await prepareSourceTransactions({
    multiProvider,
    chainName,
    protocol: protocol as ProtocolType,
    sender,
    route,
    approvalAmounts,
  });
  const publicKey = await senderPubKey;

  try {
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
    const total = estimates.reduce((sum, estimate) => sum + BigInt(estimate.fee), 0n);
    if (total <= 0n) throw new Error('Source fee estimate is empty');
    return total;
  } catch (cause) {
    if (!isEVMLike(protocol)) {
      throw new Error(`Unable to estimate source fee on ${chainName}`, { cause });
    }

    // Full-balance EVM-like simulation can fail because tx.value leaves no gas.
    // Price the engine's route gas budget instead; include approval headroom
    // when the route still needs an approval or revoke transaction.
    logger.warn('Using EVM-like source fee fallback', cause as Error);
    return estimateEvmLikeFeeForGasUnits(
      multiProvider,
      chainName,
      approvalAmounts.length ? EVM_LIKE_APPROVAL_ROUTE_GAS_BUDGET : BigInt(route.gas.originGas),
    );
  }
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

async function prepareSourceTransactions({
  multiProvider,
  chainName,
  protocol,
  sender,
  route,
  approvalAmounts,
}: {
  multiProvider: MultiProtocolProvider;
  chainName: string;
  protocol: ProtocolType;
  sender: string;
  route: RouteResponse;
  approvalAmounts: bigint[];
}): Promise<TypedTransaction[]> {
  const routeTxs = getRouteTxs(route);
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
  const approvalTransactions = await Promise.all(
    approvalAmounts.map((amount) => {
      if (!route.approval) throw new Error('Route approval details are unavailable');
      return prepareApprovalTransaction({
        multiProvider,
        chainName,
        protocol,
        token: route.approval.token,
        spender: route.approval.spender,
        amount,
      });
    }),
  );
  return [...approvalTransactions, ...routeTransactions] as TypedTransaction[];
}

type StarknetAccount = NonNullable<UseAccountResult['account']>;
type StarknetCalls = Parameters<StarknetAccount['estimateInvokeFee']>[0];

export async function estimateStarknetSourceFee(
  route: RouteResponse,
  account: StarknetAccount | undefined,
): Promise<bigint> {
  if (!account) throw new Error('Connect a Starknet wallet to estimate the source fee');
  const calls = getRouteTxs(route)
    .filter(
      (tx): tx is Extract<typeof route.tx, { protocol: string }> =>
        'protocol' in tx && tx.protocol === ProtocolType.Starknet,
    )
    .map((tx) => tx.transaction);
  if (!calls.length) throw new Error('Route has no Starknet source transaction');

  const fee = await account.estimateInvokeFee(calls as StarknetCalls);
  const amount = fee.suggestedMaxFee ?? fee.overall_fee ?? 0n;
  if (amount <= 0n) throw new Error('Starknet returned an empty source fee estimate');
  return amount;
}

export function appendSourceFee(
  feeBreakdown: FeeBreakdown | undefined,
  chainId: number | undefined,
  sourceFee: bigint | undefined,
): FeeBreakdown | undefined {
  if (!feeBreakdown || chainId == null) return feeBreakdown;
  const components = feeBreakdown.components.filter((component) => component.category !== 'source');
  if (sourceFee != null && sourceFee > 0n) {
    components.push({
      category: 'source',
      chainId,
      tokenAddress: NATIVE_ADDRESS,
      amount: sourceFee,
    });
  }
  return { ...feeBreakdown, components };
}
