import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk';

import { getRouteTxs, isChainRouteTx } from '../../api/routeTx';
import type { RouteResponse } from '../../api/types';
import { estimateNativeGasCost, estimateNativeGasCostForUnits } from '../../balances/read';
import type { FeeBreakdown } from './types';

const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';

export function withSourceGasFee(
  feeBreakdown: FeeBreakdown | undefined,
  chainId: number | undefined,
  amount: bigint | undefined,
): FeeBreakdown | undefined {
  if (!feeBreakdown || chainId == null) return feeBreakdown;
  const components = feeBreakdown.components.filter(
    (component) => component.category !== 'localGas',
  );
  if (amount && amount > 0n) {
    components.push({ category: 'localGas', chainId, tokenAddress: NATIVE_ADDRESS, amount });
  }
  return { ...feeBreakdown, components };
}

export async function estimateRouteSourceGasCost({
  multiProvider,
  chainName,
  sender,
  route,
  approvalPending,
  useRouteGasBudget = false,
}: {
  multiProvider: MultiProtocolProvider;
  chainName: string;
  sender: string;
  route: RouteResponse;
  approvalPending?: boolean;
  useRouteGasBudget?: boolean;
}): Promise<bigint> {
  if (!useRouteGasBudget) {
    const originTx = getRouteTxs(route).find(isChainRouteTx) ?? null;
    const estimated = await estimateNativeGasCost(multiProvider, {
      chainName,
      sender,
      tx: originTx,
      approvalPending,
    });
    if (estimated > 0n) return estimated;
  }

  return estimateNativeGasCostForUnits(multiProvider, {
    chainName,
    gasUnits: BigInt(route.gas.originGas),
  });
}
