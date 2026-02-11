import { InterchainAccount } from '@hyperlane-xyz/sdk';
import { useQuery } from '@tanstack/react-query';
import { logger } from '../../../utils/logger';

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
  const { data: icaAddress = null, isLoading, isError, refetch } = useQuery({
    queryKey: ['icaAddress', icaApp, userAddress, originChainName, destinationChainName] as const,
    queryFn: async (): Promise<string | null> => {
      if (!icaApp || !userAddress || !originChainName || !destinationChainName) return null;

      try {
        const addr = await icaApp.getAccount(destinationChainName, {
          origin: originChainName,
          owner: userAddress,
        });
        logger.debug('ICA address from SDK:', addr);
        return addr;
      } catch (err) {
        logger.error('Failed to fetch ICA address:', err);
        throw err;
      }
    },
    enabled: !!icaApp && !!userAddress && !!originChainName && !!destinationChainName,
    staleTime: 30_000,
    refetchInterval: false,
  });

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
