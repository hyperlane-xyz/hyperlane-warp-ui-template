import { useFormikContext } from 'formik';
import { useCallback, useEffect, useRef } from 'react';
import { WARP_QUERY_PARAMS } from '../../consts/args';
import { getQueryParams, updateQueryParam } from '../../utils/queryParams';
import { tryGetValidChainName } from '../chains/utils';
import { getTokenByIndex, getTokenIndexFromChains, useWarpCore } from '../tokens/hooks';
import { TransferFormValues } from './types';

/**
 * Hook that syncs the destination query parameter to the form
 * when isDashboard=true query parameter is present.
 * This allows the dashboard to control the destination chain selection.
 *
 * This hook only activates when isDashboard=true is in the URL,
 * ensuring it doesn't interfere with normal form behavior.
 */
export function useDashboardDestinationSync() {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const warpCore = useWarpCore();
  const lastSyncedQueryParamRef = useRef<string | null>(null);
  const isDashboardModeRef = useRef<boolean>(false);

  const syncDestination = useCallback(() => {
    const params = getQueryParams();
    const isDashboard = params.get('isDashboard') === 'true';
    const destinationParam = params.get(WARP_QUERY_PARAMS.DESTINATION);

    // Track dashboard mode changes
    const dashboardModeChanged = isDashboardModeRef.current !== isDashboard;
    isDashboardModeRef.current = isDashboard;

    if (!isDashboard || !destinationParam) {
      if (dashboardModeChanged && !isDashboard) {
        lastSyncedQueryParamRef.current = null;
      }
      return;
    }

    const validDestination = tryGetValidChainName(destinationParam, warpCore.multiProvider);

    // Only proceed if we have a valid destination
    if (!validDestination) {
      return;
    }

    // If form already matches the query param, just mark as synced and return
    if (validDestination === values.destination) {
      // Mark as synced if we haven't already
      if (lastSyncedQueryParamRef.current !== destinationParam) {
        lastSyncedQueryParamRef.current = destinationParam;
      }
      return;
    }

    if (lastSyncedQueryParamRef.current === destinationParam) {
      return;
    }

    lastSyncedQueryParamRef.current = destinationParam;

    setFieldValue('destination', validDestination);

    const tokenIndex = getTokenIndexFromChains(warpCore, null, values.origin, validDestination);
    const token = getTokenByIndex(warpCore, tokenIndex);

    if (token) {
      setFieldValue('tokenIndex', tokenIndex);
      updateQueryParam(WARP_QUERY_PARAMS.TOKEN, token.addressOrDenom);
    }
  }, [warpCore, values.origin, values.destination, setFieldValue]);

  useEffect(() => {
    syncDestination();
  }, [syncDestination]);

  useEffect(() => {
    const handlePopState = () => {
      lastSyncedQueryParamRef.current = null;
      setTimeout(() => {
        syncDestination();
      }, 0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [syncDestination]);
}
