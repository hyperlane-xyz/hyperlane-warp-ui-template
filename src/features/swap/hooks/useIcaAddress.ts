import { InterchainAccount } from '@hyperlane-xyz/sdk';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { logger } from '../../../utils/logger';
import { useStore } from '../../store';

function buildIcaAddressCacheKey(
  userAddress: string | undefined,
  originChainName?: string,
  destinationChainName?: string,
): string | null {
  if (!userAddress || !originChainName || !destinationChainName) return null;
  return `${userAddress.toLowerCase()}:${originChainName}:${destinationChainName}`;
}

export function useIcaAddress(
  icaApp: InterchainAccount | null,
  userAddress: string | undefined,
  originChainName?: string,
  destinationChainName?: string,
): {
  icaAddress: string | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
} {
  const cacheKey = useMemo(
    () => buildIcaAddressCacheKey(userAddress, originChainName, destinationChainName),
    [destinationChainName, originChainName, userAddress],
  );
  const cachedIcaAddress = useStore((s) => s.icaAddressCache);
  const setIcaAddressCacheEntry = useStore((s) => s.setIcaAddressCacheEntry);
  const icaAppRef = useRef<InterchainAccount | null>(icaApp);

  useEffect(() => {
    icaAppRef.current = icaApp;
  }, [icaApp]);

  const {
    data: resolvedIcaAddress = null,
    isPending,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    // We intentionally key by owner+origin+destination to keep ICA address cache stable
    // across InterchainAccount instance recreation.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['icaAddress', cacheKey] as const,
    queryFn: async (): Promise<string | null> => {
      if (!cacheKey) return null;

      const [owner, origin, destination] = cacheKey.split(':');
      const app = icaAppRef.current;
      if (!app || !owner || !origin || !destination) return null;

      try {
        const addr = await app.getAccount(destination, {
          origin,
          owner,
        });
        logger.debug('ICA address from SDK:', addr);
        return addr;
      } catch (err) {
        logger.error('Failed to fetch ICA address:', err);
        throw err;
      }
    },
    enabled: !!icaApp && !!userAddress && !!originChainName && !!destinationChainName && !!cacheKey,
    initialData: cacheKey ? (cachedIcaAddress[cacheKey] ?? null) : null,
    placeholderData: (previousData) =>
      previousData ?? (cacheKey ? (cachedIcaAddress[cacheKey] ?? null) : null),
    staleTime: 5 * 60_000,
    gcTime: 24 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    retry: 1,
  });
  const icaAddress = resolvedIcaAddress ?? (cacheKey ? (cachedIcaAddress[cacheKey] ?? null) : null);
  const isLoading = isPending || (isFetching && !icaAddress);

  useEffect(() => {
    if (!cacheKey || !resolvedIcaAddress) return;
    setIcaAddressCacheEntry(cacheKey, resolvedIcaAddress);
  }, [cacheKey, resolvedIcaAddress, setIcaAddressCacheEntry]);

  return {
    icaAddress,
    isLoading,
    isError,
    refetch: async () => {
      const result = await refetch();
      return result.data;
    },
  };
}
