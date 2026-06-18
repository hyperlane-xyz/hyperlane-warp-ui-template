import type { LabeledMsgId } from '../transfer/engine/types';

export function getTransferDeliveryMsgId(msgIds: LabeledMsgId[] | undefined) {
  return (
    msgIds?.find((m) => m.label === 'reveal') ??
    msgIds?.find((m) => m.label === 'bridge') ??
    msgIds?.find((m) => m.label === 'warp') ??
    msgIds?.[0]
  )?.msgId;
}
