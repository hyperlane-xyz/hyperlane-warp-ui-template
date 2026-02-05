import type { MultiProtocolProvider, WarpCore } from '@hyperlane-xyz/sdk';
import { fromWei } from '@hyperlane-xyz/utils';
import { useMemo } from 'react';
import { tryFindToken } from '../tokens/hooks';
import { TransferContext, TransferStatus } from '../transfer/types';
import { MessageStatus, MessageStub } from './types';

// Union type for transfer items from both local state and API
export type TransferItem =
  | { type: 'local'; data: TransferContext }
  | { type: 'api'; data: MessageStub };

/**
 * Convert an API MessageStub to a TransferContext for display
 */
export function messageToTransferContext(
  msg: MessageStub,
  multiProvider: MultiProtocolProvider,
  warpCore: WarpCore,
): TransferContext {
  const originChain = multiProvider.tryGetChainName(msg.originDomainId) || '';
  const destChain = multiProvider.tryGetChainName(msg.destinationDomainId) || '';

  // Use actual sender (tx sender) and recipient (from warp message body)
  const actualSender = msg.origin.from;
  const actualRecipient = msg.warpTransfer?.recipient || msg.recipient;

  // Format amount if available
  let formattedAmount = '';
  const token = tryFindToken(warpCore, originChain, msg.sender);
  if (msg.warpTransfer?.amount && token?.decimals) {
    formattedAmount = fromWei(msg.warpTransfer.amount, token.decimals);
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
      .map((t) => ({ type: 'local' as const, data: t }));

    // API messages
    const apiItems: TransferItem[] = apiMessages.map((m) => ({
      type: 'api' as const,
      data: m,
    }));

    // Sort by timestamp descending
    return [...localItems, ...apiItems].sort((a, b) => {
      const tsA = a.type === 'local' ? a.data.timestamp : a.data.origin.timestamp;
      const tsB = b.type === 'local' ? b.data.timestamp : b.data.origin.timestamp;
      return tsB - tsA;
    });
  }, [localTransfers, apiMessages]);
}
