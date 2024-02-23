import { TransactionReceipt } from 'viem';

import { HyperlaneCore } from '@hyperlane-xyz/sdk';

import { logger } from '../../utils/logger';

// TODO multiprotocol
export function tryGetMsgIdFromTransferReceipt(receipt: TransactionReceipt) {
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
