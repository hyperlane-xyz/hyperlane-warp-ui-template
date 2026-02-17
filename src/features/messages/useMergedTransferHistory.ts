import type { ChainName, MultiProtocolProvider, WarpCore } from '@hyperlane-xyz/sdk';
import { fromWei, normalizeAddress } from '@hyperlane-xyz/utils';
import { useMemo } from 'react';
import { logger } from '../../utils/logger';
import { RouterAddressInfo } from '../store';
import { tryFindToken } from '../tokens/hooks';
import { TransferContext, TransferStatus } from '../transfer/types';
import { MessageStatus, MessageStub } from './types';

export const TransferItemType = {
  Local: 'local',
  Api: 'api',
} as const;

export type TransferItem =
  | { type: typeof TransferItemType.Local; data: TransferContext }
  | { type: typeof TransferItemType.Api; data: MessageStub };

/**
 * Convert an API MessageStub to a TransferContext for display
 */
export function messageToTransferContext(
  msg: MessageStub,
  multiProvider: MultiProtocolProvider,
  warpCore: WarpCore,
  routerAddressesByChainMap: Record<ChainName, Record<string, RouterAddressInfo>>,
): TransferContext {
  const originChain = multiProvider.tryGetChainName(msg.originDomainId) || '';
  const destChain = multiProvider.tryGetChainName(msg.destinationDomainId) || '';

  // Use actual sender (tx sender) and recipient (from warp message body)
  const actualSender = msg.origin.from;
  const actualRecipient = msg.warpTransfer?.recipient || msg.recipient;

  // Format amount using wire decimals from precomputed map
  let formattedAmount = '';
  const token = tryFindToken(warpCore, originChain, msg.sender);
  if (msg.warpTransfer?.amount && token) {
    const normalizedSender = normalizeAddress(msg.sender);
    const routerInfo = routerAddressesByChainMap[originChain]?.[normalizedSender];
    const wireDecimals = routerInfo?.wireDecimals ?? token.decimals;
    try {
      formattedAmount = fromWei(msg.warpTransfer.amount, wireDecimals);
    } catch (err) {
      logger.error('Failed to format warp transfer amount', err);
    }
  }

  return {
    status:
      msg.status === MessageStatus.Delivered
        ? TransferStatus.Delivered
        : TransferStatus.ConfirmedTransfer,
    origin: originChain,
    destination: destChain,
    amount: formattedAmount,
    sender: actualSender,
    recipient: actualRecipient,
    originTxHash: msg.origin.hash,
    msgId: msg.msgId,
    timestamp: msg.origin.timestamp,
    originTokenAddressOrDenom: msg.sender,
  };
}

/**
 * Hook to merge local transfers with API messages
 * Local transfers are shown until they appear in the API results
 */
export function useMergedTransferHistory(
  localTransfers: TransferContext[],
  apiMessages: MessageStub[],
): TransferItem[] {
  return useMemo(() => {
    const apiMsgIds = new Set(apiMessages.map((m) => m.msgId));

    // Local transfers that aren't in API yet
    const localItems: TransferItem[] = localTransfers
      .filter((t) => !t.msgId || !apiMsgIds.has(t.msgId))
      .map((t) => ({ type: TransferItemType.Local, data: t }));

    // API messages
    const apiItems: TransferItem[] = apiMessages.map((m) => ({
      type: TransferItemType.Api,
      data: m,
    }));

    // Sort by timestamp descending
    return [...localItems, ...apiItems].sort((a, b) => {
      const tsA = a.type === TransferItemType.Local ? a.data.timestamp : a.data.origin.timestamp;
      const tsB = b.type === TransferItemType.Local ? b.data.timestamp : b.data.origin.timestamp;
      return tsB - tsA;
    });
  }, [localTransfers, apiMessages]);
}
