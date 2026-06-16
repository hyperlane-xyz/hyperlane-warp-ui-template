import { UnifiedRouteMode } from './tokens/routes';

export function shouldFetchUnifiedSwapQuote(routeMode: UnifiedRouteMode | null): boolean {
  return routeMode === UnifiedRouteMode.Swap;
}

export function shouldFetchUnifiedBridgeFeeQuote({
  routeMode,
  isBridgeQuoteCurrent,
}: {
  routeMode: UnifiedRouteMode | null;
  isBridgeQuoteCurrent: boolean;
}): boolean {
  return routeMode === UnifiedRouteMode.Bridge && isBridgeQuoteCurrent;
}
