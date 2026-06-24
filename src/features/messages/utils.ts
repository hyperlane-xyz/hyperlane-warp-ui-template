import type { LabeledMsgId } from '../swap/types';

export function getSwapDeliveryMsgId(msgIds: LabeledMsgId[] | undefined) {
  return (msgIds?.find((m) => m.label === 'warp') ?? msgIds?.[0])?.msgId;
}
