import { TokenAmount } from '@hyperlane-xyz/sdk';
import { timeout } from '@hyperlane-xyz/utils';

import { getWarpCore } from '../../context/context';
import { logger } from '../../utils/logger';

export async function fetchMaxAmount(
  balance: TokenAmount,
  destination: ChainName,
  sender: Address,
) {
  try {
    const maxAmount = await timeout(
      getWarpCore().getMaxTransferAmount(balance, destination, sender),
      1500,
    );
    return maxAmount;
  } catch (error) {
    logger.warn('Error or timeout fetching fee quotes for max amount', error);
    return balance;
  }
}
