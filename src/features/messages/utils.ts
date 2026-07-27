import type { LabeledMsgId } from '../transfer/engine/types';

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
