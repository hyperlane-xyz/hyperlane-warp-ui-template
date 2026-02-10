import { deriveIcaAddress } from '@hyperlane-xyz/sdk';
import { useMemo } from 'react';
import { logger } from '../../../utils/logger';
import { getSwapConfig } from '../swapConfig';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function useIcaAddress(
  userAddress: string | undefined,
  originChainName?: string,
  destinationChainName?: string,
): {
  icaAddress: string | null;
  isLoading: boolean;
} {
  const icaAddress = useMemo(() => {
    if (!userAddress || !originChainName || !destinationChainName) return null;

    const originConfig = getSwapConfig(originChainName);
    const destConfig = getSwapConfig(destinationChainName);
    if (!originConfig || !destConfig) return null;

    try {
      const addr = deriveIcaAddress({
        origin: originConfig.domainId,
        owner: userAddress,
        routerAddress: destConfig.icaRouter,
        ismAddress: ZERO_ADDRESS,
      });
      logger.debug('Derived ICA address:', addr);
      return addr;
    } catch (err) {
      logger.error('Failed to derive ICA address:', err);
      return null;
    }
  }, [userAddress, originChainName, destinationChainName]);

  return { icaAddress, isLoading: false };
}
