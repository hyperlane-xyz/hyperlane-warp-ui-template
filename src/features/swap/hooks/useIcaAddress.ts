import { useMemo } from 'react';
import { encodePacked, getAddress, keccak256 } from 'viem';
import { SWAP_CONTRACTS } from '../swapConfig';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_BYTES_32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

export function useIcaAddress(userAddress: string | undefined): {
  icaAddress: string | null;
  isLoading: boolean;
} {
  const icaAddress = useMemo(() => {
    if (!userAddress) return null;

    try {
      const salt = keccak256(
        encodePacked(
          ['uint32', 'address', 'address', 'address', 'bytes32'],
          [
            42161,
            userAddress as `0x${string}`,
            SWAP_CONTRACTS.icaRouterBase as `0x${string}`,
            ZERO_ADDRESS,
            ZERO_BYTES_32,
          ],
        ),
      );

      const derivedAddress = `0x${salt.slice(26)}` as `0x${string}`;
      return getAddress(derivedAddress);
    } catch {
      return null;
    }
  }, [userAddress]);

  return { icaAddress, isLoading: false };
}
