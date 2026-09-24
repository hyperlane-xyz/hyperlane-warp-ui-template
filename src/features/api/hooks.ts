import { useQuery } from '@tanstack/react-query';

import { routerClient } from './RouterClient';

const STALE_5_MIN = 5 * 60 * 1000;

export function useReadiness() {
  return useQuery({
    queryKey: ['router', 'readiness'],
    queryFn: ({ signal }) => routerClient.readiness({ signal }),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useChains() {
  return useQuery({
    queryKey: ['router', 'chains'],
    queryFn: ({ signal }) => routerClient.chains({ signal }),
    staleTime: STALE_5_MIN,
  });
}
