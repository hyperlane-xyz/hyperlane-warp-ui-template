import { useQuery } from '@tanstack/react-query';

import { useMultiProvider } from '../../chains/hooks';
import { estimateRouteSourceGasCost } from './sourceGas';
import type { AugmentedRoute } from './types';

const REFRESH_MS = 25_000;

export function useSourceGasFee({
  route,
  chainName,
  sender,
  senderPubKey,
  approvalPending,
  estimateOverride,
}: {
  route: AugmentedRoute | undefined;
  chainName: string | undefined;
  sender: string | undefined;
  senderPubKey?: Parameters<typeof estimateRouteSourceGasCost>[0]['senderPubKey'];
  approvalPending: boolean;
  estimateOverride?: () => Promise<bigint>;
}) {
  const multiProvider = useMultiProvider();

  return useQuery({
    queryKey: [
      'sourceGasFee',
      chainName,
      sender,
      route?.raw.steps[0]?.amountIn ?? null,
      route?.raw.gas.originGas ?? null,
      route?.raw.tx ?? null,
      route?.raw.txs ?? null,
      approvalPending,
    ],
    queryFn: () =>
      estimateOverride?.() ??
      estimateRouteSourceGasCost({
        multiProvider,
        chainName: chainName!,
        sender: sender!,
        senderPubKey,
        route: route!.raw,
        approvalPending,
      }),
    enabled: !!route && !!chainName && !!sender,
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
  });
}
