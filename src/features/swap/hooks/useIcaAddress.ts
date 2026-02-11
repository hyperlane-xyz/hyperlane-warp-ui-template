import { InterchainAccount } from '@hyperlane-xyz/sdk';
import { addressToBytes32 } from '@hyperlane-xyz/utils';
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
} {
  const { data: icaAddress = null, isLoading } = useQuery({
    queryKey: ['icaAddress', icaApp, userAddress, originChainName, destinationChainName] as const,
    queryFn: async (): Promise<string | null> => {
      if (!icaApp || !userAddress || !originChainName || !destinationChainName) return null;

      try {
        const addr = await icaApp.getAccount(destinationChainName, {
          origin: originChainName,
          owner: addressToBytes32(userAddress),
        });
        logger.debug('ICA address from SDK:', addr);
        return addr;
      } catch (err) {
        logger.error('Failed to fetch ICA address:', err);
        return null;
      }
    },
    enabled: !!icaApp && !!userAddress && !!originChainName && !!destinationChainName,
    staleTime: 5 * 60_000,
    refetchInterval: false,
  });

  return { icaAddress, isLoading };
}
