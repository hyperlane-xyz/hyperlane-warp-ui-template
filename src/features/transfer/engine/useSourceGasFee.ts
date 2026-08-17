import { useQuery } from '@tanstack/react-query';

import { getRouteTxs, isChainRouteTx } from '../../api/routeTx';
import { useMultiProvider } from '../../chains/hooks';
import { estimateRouteSourceGasCost } from './sourceGas';
import type { AugmentedRoute } from './types';

const REFRESH_MS = 25_000;

export function useSourceGasFee({
  route,
  chainName,
  sender,
  approvalPending,
}: {
  route: AugmentedRoute | undefined;
  chainName: string | undefined;
  sender: string | undefined;
  approvalPending: boolean;
}) {
  const multiProvider = useMultiProvider();
  const originTx = route ? (getRouteTxs(route.raw).find(isChainRouteTx) ?? null) : null;

  return useQuery({
    queryKey: [
      'sourceGasFee',
      chainName,
      sender,
      route?.raw.gas.originGas ?? null,
      originTx?.to ?? null,
      originTx?.data ?? null,
      originTx?.value ?? null,
      approvalPending,
    ],
    queryFn: () =>
      estimateRouteSourceGasCost({
        multiProvider,
        chainName: chainName!,
        sender: sender!,
        route: route!.raw,
        approvalPending,
      }),
    enabled: !!route && !!chainName && !!sender,
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
  });
}
