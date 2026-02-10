import { Token } from '@hyperlane-xyz/sdk';
import { useMemo } from 'react';
import { SWAP_CONTRACTS } from '../swap/swapConfig';
import { checkTokenHasRoute } from '../tokens/utils';

export type TransferRouteType = 'warp' | 'swap-bridge' | 'unavailable';

export interface TransferRoute {
  routeType: TransferRouteType;
  bridgeToken?: string;
}

const SUPPORTED_SWAP_CHAINS = new Set(['arbitrum', 'base']);

export function useTransferRoute(
  originToken: Token | undefined,
  destinationToken: Token | undefined,
  collateralGroups: Map<string, Token[]>,
): TransferRoute {
  return useMemo(() => {
    if (!originToken || !destinationToken) {
      return { routeType: 'unavailable' };
    }

    if (checkTokenHasRoute(originToken, destinationToken, collateralGroups)) {
      return { routeType: 'warp' };
    }

    if (
      SUPPORTED_SWAP_CHAINS.has(originToken.chainName) &&
      SUPPORTED_SWAP_CHAINS.has(destinationToken.chainName) &&
      originToken.chainName !== destinationToken.chainName
    ) {
      return {
        routeType: 'swap-bridge',
        bridgeToken: SWAP_CONTRACTS.usdcArb,
      };
    }

    return { routeType: 'unavailable' };
  }, [originToken, destinationToken, collateralGroups]);
}
