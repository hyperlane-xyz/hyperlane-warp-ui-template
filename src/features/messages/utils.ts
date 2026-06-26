import type { LabeledMsgId } from '../swap/types';

export function getSwapDeliveryMsgId(msgIds: LabeledMsgId[] | undefined) {
  // For CCS routes, track the reveal message delivery — that tx is the one where
  // the ICA executes the swap. For regular warp routes there is no reveal, so
  // fall back to the warp message (unchanged behavior).
  return (
    msgIds?.find((m) => m.label === 'reveal') ??
    msgIds?.find((m) => m.label === 'warp') ??
    msgIds?.[0]
  )?.msgId;
}
