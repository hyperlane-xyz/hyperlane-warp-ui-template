import { deriveIcaAddress } from '@hyperlane-xyz/sdk';
import { useMemo } from 'react';
import { SWAP_CONTRACTS } from '../swapConfig';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function useIcaAddress(userAddress: string | undefined): {
  icaAddress: string | null;
  isLoading: boolean;
} {
  const icaAddress = useMemo(() => {
    if (!userAddress) return null;

    try {
      return deriveIcaAddress({
        origin: 42161,
        owner: userAddress,
        routerAddress: SWAP_CONTRACTS.icaRouterBase,
        ismAddress: ZERO_ADDRESS,
      });
    } catch {
      return null;
    }
  }, [userAddress]);

  return { icaAddress, isLoading: false };
}
