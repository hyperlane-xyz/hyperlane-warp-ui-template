import BigNumber from 'bignumber.js';

import { UnifiedRouteMode } from './tokens/routes';
import type { UnifiedToken } from './tokens/types';
import type { UnifiedFormValues } from './types';

export function getUnifiedBasicSubmitErrors({
  routeMode,
  values,
  originToken,
  destinationToken,
  recipient,
  hasSwapRoute,
}: {
  routeMode: UnifiedRouteMode | null;
  values: UnifiedFormValues;
  originToken: UnifiedToken | undefined;
  destinationToken: UnifiedToken | undefined;
  recipient: string;
  hasSwapRoute: boolean;
}): Record<string, string> | null {
  if (!routeMode) return { destinationTokenKey: 'Route is not supported' };
  if (!originToken) return { originTokenKey: 'Origin token is required' };
  if (!destinationToken) return { destinationTokenKey: 'Destination token is required' };
  if (!values.amount || !new BigNumber(values.amount).isFinite()) {
    return { amount: 'Invalid amount' };
  }
  if (!new BigNumber(values.amount).gt(0)) return { amount: 'Invalid amount' };
  if (!recipient) return { recipient: 'Invalid recipient' };
  if (routeMode === UnifiedRouteMode.Swap && !hasSwapRoute) {
    return { destinationTokenKey: 'Route is not supported' };
  }
  return null;
}
