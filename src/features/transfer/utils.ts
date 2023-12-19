import BigNumber from 'bignumber.js';
import { toast } from 'react-toastify';
import { TransactionReceipt } from 'viem';

import { HyperlaneCore } from '@hyperlane-xyz/sdk';
import { ProtocolType, convertDecimals } from '@hyperlane-xyz/utils';

import { logger } from '../../utils/logger';
import { getProtocolType } from '../caip/chains';
import { isNonFungibleToken } from '../caip/tokens';
import { AdapterFactory } from '../tokens/AdapterFactory';
import { Route } from '../tokens/routes/types';
import { isRouteToCollateral, isWarpRoute } from '../tokens/routes/utils';

// In certain cases, like when a synthetic token has >1 collateral tokens
// it's possible that the collateral contract balance is insufficient to
// cover the remote transfer. This ensures the balance is sufficient or throws.
export async function ensureSufficientCollateral(route: Route, weiAmount: string) {
  if (!isRouteToCollateral(route) || isNonFungibleToken(route.baseTokenCaip19Id)) return;

  // TODO cosmos support here
  if (
    getProtocolType(route.originCaip2Id) === ProtocolType.Cosmos ||
    getProtocolType(route.destCaip2Id) === ProtocolType.Cosmos ||
    !isWarpRoute(route)
  )
    return;

  logger.debug('Ensuring collateral balance for route', route);
  const adapter = AdapterFactory.HypTokenAdapterFromRouteDest(route);
  const destinationBalance = await adapter.getBalance(route.destRouterAddress);
  const destinationBalanceInOriginDecimals = convertDecimals(
    route.destDecimals,
    route.originDecimals,
    destinationBalance,
  );
  if (new BigNumber(destinationBalanceInOriginDecimals).lt(weiAmount)) {
    toast.error('Collateral contract balance insufficient for transfer');
    throw new Error('Insufficient collateral balance');
  }
}

export function tryGetMsgIdFromEvmTransferReceipt(receipt: TransactionReceipt) {
  try {
    // TODO viem
    // @ts-ignore
    const messages = HyperlaneCore.getDispatchedMessages(receipt);
    if (messages.length) {
      const msgId = messages[0].id;
      logger.debug('Message id found in logs', msgId);
      return msgId;
    } else {
      logger.warn('No messages found in logs');
      return undefined;
    }
  } catch (error) {
    logger.error('Could not get msgId from transfer receipt', error);
    return undefined;
  }
}
