import { ProtocolType } from '@hyperlane-xyz/utils';

import { getRouteTxs, isChainRouteTx } from '../../api/routeTx';
import type { RouteResponse } from '../../api/types';

export function shouldCalculateNativeMax(
  isNative: boolean,
  protocol: ProtocolType | undefined,
): boolean {
  return isNative && protocol === ProtocolType.Ethereum;
}

export function getRouteInputAmount(route: RouteResponse): bigint | null {
  const initialStep = route.steps[0];
  return initialStep && 'amountIn' in initialStep ? BigInt(initialStep.amountIn) : null;
}

// Native tx.value can exceed the route input when a native-origin swap later
// pays IGP on top of an ERC20 bridge. Embedded native-route IGP is already in
// amountIn, so tx.value === amountIn and does not add another reserve.
export function calculateNativeMaxInput({
  balance,
  route,
  gasCost,
}: {
  balance: bigint;
  route: RouteResponse;
  gasCost: bigint;
}): bigint {
  const routeInput = getRouteInputAmount(route);
  if (routeInput == null) throw new Error('Max quote route has no input amount');

  const originTx = getRouteTxs(route).find(isChainRouteTx);
  const txValue = originTx ? BigInt(originTx.value) : routeInput;
  const additionalTxValue = txValue > routeInput ? txValue - routeInput : 0n;
  const reserve = gasCost + additionalTxValue;
  return balance > reserve ? balance - reserve : 0n;
}
