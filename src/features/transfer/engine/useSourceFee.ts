import { ProtocolType } from '@hyperlane-xyz/utils';
import type { UseAccountResult } from '@starknet-react/core';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { RouteResponse } from '../../api/types';
import { useMultiProvider } from '../../chains/hooks';
import { estimateRouteSourceFee, estimateStarknetSourceFee } from './sourceFee';
import type { AugmentedRoute } from './types';

const REFRESH_MS = 25_000;

export function useSourceFee({
  route,
  estimate,
  cacheKey,
}: {
  route: AugmentedRoute | undefined;
  estimate: (route: RouteResponse) => Promise<bigint>;
  cacheKey: readonly unknown[];
}) {
  const query = useQuery({
    queryKey: ['sourceFee', ...cacheKey, route?.raw ?? null],
    queryFn: async () => requireSourceFee(await estimate(route!.raw)),
    enabled: !!route,
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
  });
  const { refetch } = query;
  const getFresh = useCallback(async (): Promise<bigint> => {
    if (!route) return 0n;
    const result = await refetch();
    if (result.error) throw result.error;
    return requireSourceFee(result.data);
  }, [refetch, route]);

  return { ...query, getFresh };
}

function requireSourceFee(fee: bigint | undefined): bigint {
  if (fee == null || fee <= 0n) throw new Error('Source fee estimate is unavailable');
  return fee;
}

type StarknetAccount = NonNullable<UseAccountResult['account']>;

export function useSourceFeeEstimator({
  chainName,
  sender,
  senderPubKey,
  protocol,
  approvalAmounts,
  starknetAccount,
}: {
  chainName: string | undefined;
  sender: string | undefined;
  senderPubKey: Parameters<typeof estimateRouteSourceFee>[0]['senderPubKey'];
  protocol: ProtocolType | undefined;
  approvalAmounts: bigint[];
  starknetAccount: StarknetAccount | undefined;
}) {
  const multiProvider = useMultiProvider();
  return useCallback(
    (route: RouteResponse) => {
      if (!chainName || !sender || !protocol) throw new Error('Source wallet is not ready');
      if (protocol === ProtocolType.Starknet) {
        return estimateStarknetSourceFee(route, starknetAccount);
      }
      return estimateRouteSourceFee({
        multiProvider,
        chainName,
        sender,
        senderPubKey,
        route,
        approvalAmounts,
      });
    },
    [approvalAmounts, chainName, multiProvider, protocol, sender, senderPubKey, starknetAccount],
  );
}
