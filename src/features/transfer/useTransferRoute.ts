import { Token } from '@hyperlane-xyz/sdk';
import { useMemo } from 'react';
import { getSwapConfig, isSwapSupported } from '../swap/swapConfig';
import { checkTokenHasRoute } from '../tokens/utils';

export type TransferRouteType = 'warp' | 'swap-bridge' | 'unavailable';

export interface TransferRoute {
  routeType: TransferRouteType;
  bridgeToken?: string;
}

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

    if (isSwapSupported(originToken.chainName, destinationToken.chainName)) {
      const originConfig = getSwapConfig(originToken.chainName);
      return {
        routeType: 'swap-bridge',
        bridgeToken: originConfig?.bridgeToken,
      };
    }

    return { routeType: 'unavailable' };
  }, [originToken, destinationToken, collateralGroups]);
}
