import { ProtocolType } from '@hyperlane-xyz/utils';
import { useFormikContext } from 'formik';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatUnits } from 'viem';

import type { RouteResponse } from '../../api/types';
import type { UiToken } from '../../tokens/types';
import { getSourceFunding } from './routeFunding';
import type { AugmentedQuote, TransferFormValues } from './types';

export function useNativeMax({
  intentKey,
  originChainId,
  originProtocol,
  quoteForAmount,
  estimateSourceFee,
}: {
  intentKey: string;
  originChainId: number | undefined;
  originProtocol: ProtocolType | undefined;
  quoteForAmount: (amount: bigint) => Promise<AugmentedQuote>;
  estimateSourceFee: (route: RouteResponse) => Promise<bigint>;
}) {
  const { values, setFieldError, setFieldValue } = useFormikContext<TransferFormValues>();
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);
  const intentRef = useRef(intentKey);
  const expectedAmountRef = useRef<string | undefined>(undefined);
  const previousIntentRef = useRef(intentKey);
  intentRef.current = intentKey;

  useEffect(() => {
    if (previousIntentRef.current === intentKey) return;
    previousIntentRef.current = intentKey;
    requestIdRef.current += 1;
    expectedAmountRef.current = undefined;
    setIsLoading(false);
  }, [intentKey]);

  // A manual amount edit cancels an in-flight native Max calculation.
  useEffect(() => {
    const expected = expectedAmountRef.current;
    if (expected == null || values.amount === expected) return;
    requestIdRef.current += 1;
    expectedAmountRef.current = undefined;
    setIsLoading(false);
  }, [values.amount]);

  const onMax = useCallback(
    async (balance: bigint, token: UiToken) => {
      const fullBalance = formatUnits(balance, token.decimals);
      if (!token.isNative) {
        await setFieldValue('amount', fullBalance, false);
        return;
      }
      if (originChainId == null || !originProtocol) {
        setFieldError('amount', 'Origin chain is not ready');
        return;
      }

      const requestId = ++requestIdRef.current;
      const previousAmount = values.amount;
      const requestIntent = intentKey;
      const isCurrent = () =>
        requestIdRef.current === requestId && intentRef.current === requestIntent;

      expectedAmountRef.current = fullBalance;
      setIsLoading(true);
      // This exposes the requested Max amount immediately. quoteForAmount
      // fetches the matching quote now; setting the reduced amount below lets
      // the normal debounced useQuote query fetch the final executable quote.
      await setFieldValue('amount', fullBalance, false);

      try {
        const maxAmount = await calculateNativeMaxAmount({
          balance,
          originChainId,
          originProtocol,
          sourceTokenAddress: token.address,
          quoteForAmount,
          estimateSourceFee,
        });
        if (!isCurrent()) return;

        const finalAmount = formatUnits(maxAmount, token.decimals);
        expectedAmountRef.current = finalAmount;
        await setFieldValue('amount', finalAmount, false);
      } catch (cause) {
        if (!isCurrent()) return;
        expectedAmountRef.current = previousAmount;
        await setFieldValue('amount', previousAmount, false);
        setFieldError(
          'amount',
          cause instanceof Error ? cause.message : 'Unable to calculate the maximum amount',
        );
      } finally {
        if (isCurrent()) {
          expectedAmountRef.current = undefined;
          setIsLoading(false);
        }
      }
    },
    [
      estimateSourceFee,
      intentKey,
      originChainId,
      originProtocol,
      quoteForAmount,
      setFieldError,
      setFieldValue,
      values.amount,
    ],
  );

  return { isLoading, onMax };
}

// One explicit async sequence used by the Max click handler:
// full-balance quote -> source transaction fee -> spendable native amount.
export async function calculateNativeMaxAmount({
  balance,
  originChainId,
  originProtocol,
  sourceTokenAddress,
  quoteForAmount,
  estimateSourceFee,
}: {
  balance: bigint;
  originChainId: number;
  originProtocol: ProtocolType;
  sourceTokenAddress: string;
  quoteForAmount: (amount: bigint) => Promise<AugmentedQuote>;
  estimateSourceFee: (route: RouteResponse) => Promise<bigint>;
}): Promise<bigint> {
  const quote = await quoteForAmount(balance);
  const route = quote.routes[0]?.raw;
  if (!route) throw new Error('No safe route available for the full balance');

  const sourceFee = await estimateSourceFee(route);
  if (sourceFee <= 0n) throw new Error('Source fee estimate is unavailable');

  const funding = getSourceFunding({
    route,
    originChainId,
    originProtocol,
    sourceTokenAddress,
    sourceTokenIsNative: true,
    fallbackAmountIn: balance,
  });
  if (funding.amountIn !== balance) throw new Error('Full-balance quote amount is stale');

  const additionalNativeFunding =
    funding.nativeRequired > funding.amountIn ? funding.nativeRequired - funding.amountIn : 0n;
  const reserve = sourceFee + additionalNativeFunding;
  const maxAmount = balance > reserve ? balance - reserve : 0n;
  if (maxAmount <= 0n) throw new Error('Native balance is too low to cover source fees');
  return maxAmount;
}
