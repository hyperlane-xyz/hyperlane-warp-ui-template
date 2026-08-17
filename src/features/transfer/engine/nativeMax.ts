import { ProtocolType } from '@hyperlane-xyz/utils';

import { getRouteTxs, isChainRouteTx } from '../../api/routeTx';
import type { RouteResponse } from '../../api/types';

export function shouldCalculateNativeMax(isNative: boolean): boolean {
  return isNative;
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
  originProtocol,
}: {
  balance: bigint;
  route: RouteResponse;
  gasCost: bigint;
  originProtocol: ProtocolType;
}): bigint {
  const routeInput = getRouteInputAmount(route);
  if (routeInput == null) throw new Error('Max quote route has no input amount');
  const originChain = route.steps[0]?.chain;

  const originTx = getRouteTxs(route).find(isChainRouteTx);
  const txValue = originTx ? BigInt(originTx.value) : routeInput;
  const additionalTxValue = txValue > routeInput ? txValue - routeInput : 0n;
  const externalNativeFees = route.steps.reduce((total, step) => {
    if (step.type !== 'bridge' || step.chain !== originChain) return total;
    const igpIsNative = /^0x0+$/i.test(step.fee.igpToken);
    const igpIsIncluded =
      step.fee.igpIncludedInAmountIn ??
      (/^0x0+$/i.test(step.asset) && originProtocol === ProtocolType.Ethereum);
    const externalIgp = igpIsNative && !igpIsIncluded ? BigInt(step.fee.igpAmount) : 0n;
    return total + externalIgp + BigInt(step.fee.localNativeFee);
  }, 0n);
  const additionalNativeValue =
    additionalTxValue > externalNativeFees ? additionalTxValue : externalNativeFees;
  const reserve = gasCost + additionalNativeValue;
  return balance > reserve ? balance - reserve : 0n;
}
