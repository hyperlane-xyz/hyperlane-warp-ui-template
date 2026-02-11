import { useQuery } from '@tanstack/react-query';
import { parseAbi } from 'viem';
import { usePublicClient } from 'wagmi';
import { logger } from '../../../utils/logger';
import { getSwapConfig } from '../swapConfig';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const icaRouterAbi = parseAbi([
  'function getLocalInterchainAccount(uint32 _origin, address _owner, address _router, address _ism) view returns (address)',
]);

export function useIcaAddress(
  userAddress: string | undefined,
  originChainName?: string,
  destinationChainName?: string,
): {
  icaAddress: string | null;
  isLoading: boolean;
} {
  const destConfig = getSwapConfig(destinationChainName || '');
  const originConfig = getSwapConfig(originChainName || '');
  const destIcaRouter = destConfig?.icaRouter;
  const originIcaRouter = originConfig?.icaRouter;
  const originDomainId = originConfig?.domainId;
  const publicClient = usePublicClient({ chainId: destConfig?.chainId });

  const { data: icaAddress = null, isLoading } = useQuery({
    queryKey: [
      'icaAddress',
      userAddress,
      destIcaRouter,
      originIcaRouter,
      originDomainId,
      publicClient,
    ] as const,
    queryFn: async (): Promise<string | null> => {
      if (!userAddress || !destIcaRouter || !originIcaRouter || !originDomainId || !publicClient)
        return null;

      try {
        const addr = await publicClient.readContract({
          address: destIcaRouter as `0x${string}`,
          abi: icaRouterAbi,
          functionName: 'getLocalInterchainAccount',
          args: [
            originDomainId,
            userAddress as `0x${string}`,
            originIcaRouter as `0x${string}`,
            ZERO_ADDRESS,
          ],
        });
        logger.debug('ICA address from on-chain:', addr);
        return addr;
      } catch (err) {
        logger.error('Failed to fetch ICA address on-chain:', err);
        return null;
      }
    },
    enabled:
      !!userAddress && !!destIcaRouter && !!originIcaRouter && !!originDomainId && !!publicClient,
    staleTime: 5 * 60_000,
    refetchInterval: false,
  });

  return { icaAddress, isLoading };
}
