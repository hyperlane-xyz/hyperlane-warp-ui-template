import type { LabeledMsgId, TransferHistoryItem } from '../transfer/engine/types';

export function getTransferDeliveryMsgId(msgIds: LabeledMsgId[] | undefined) {
  // For CCS routes, track the reveal message delivery — that tx is the one where
  // the ICA executes the transfer. For regular bridge routes there is no reveal,
  // so fall back to the bridge/warp message.
  return (
    msgIds?.find((m) => m.label === 'reveal') ??
    msgIds?.find((m) => m.label === 'bridge') ??
    msgIds?.find((m) => m.label === 'warp') ??
    msgIds?.[0]
  )?.msgId;
}

export function getTransferOverviewMsgId(
  transfer: Pick<
    TransferHistoryItem,
    'msgIds' | 'dstChain' | 'routeSteps' | 'destinationOutcome' | 'solanaDestSwapPda'
  >,
) {
  const { msgIds, dstChain, routeSteps, destinationOutcome, solanaDestSwapPda } = transfer;
  // Legacy transfers may not retain their route. Keep the execution message
  // unless the stored route proves that no destination swap is needed.
  if (
    destinationOutcome ||
    solanaDestSwapPda ||
    !routeSteps?.length ||
    routeSteps.some((step) => step.type === 'swap' && step.chain === dstChain)
  )
    return getTransferDeliveryMsgId(msgIds);
  return (
    msgIds?.find((message) => message.label === 'bridge' || message.label === 'warp')?.msgId ??
    getTransferDeliveryMsgId(msgIds)
  );
}
