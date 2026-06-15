import { useQuery } from '@tanstack/react-query';

import { routerClient } from './RouterClient';

const STALE_5_MIN = 5 * 60 * 1000;

export function useReadiness() {
  return useQuery({
    queryKey: ['router', 'readiness'],
    queryFn: () => routerClient.readiness(),
    enabled: routerClient.isConfigured,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useChains() {
  return useQuery({
    queryKey: ['router', 'chains'],
    queryFn: () => routerClient.chains(),
    enabled: routerClient.isConfigured,
    staleTime: STALE_5_MIN,
  });
}
