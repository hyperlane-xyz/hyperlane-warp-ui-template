import {
  FinalSwapStatuses,
  SwapStatus,
  type LabeledMsgId,
  type SwapHistoryItem,
} from '../swap/types';

type DeliveryUpdateState = {
  hasUpdated: boolean;
  hasBackfilledHash: boolean;
};

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

export function getSwapHistoryMessageIds(
  swaps: Array<Pick<SwapHistoryItem, 'msgIds'>>,
): Set<string> {
  const ids = new Set<string>();
  for (const swap of swaps) {
    for (const msg of swap.msgIds ?? []) ids.add(msg.msgId.toLowerCase());
  }
  return ids;
}

export function shouldWatchSwapDeliveryStatus({
  status,
  destinationTxHash,
  solanaDestSwapPda,
}: Pick<SwapHistoryItem, 'status' | 'destinationTxHash' | 'solanaDestSwapPda'>): boolean {
  if (!FinalSwapStatuses.includes(status)) return true;
  return status === SwapStatus.ConfirmedDestination && !destinationTxHash && !solanaDestSwapPda;
}

export function prioritizeSelectedTarget<T extends { id: string }>(
  targets: T[],
  selectedTransactionId: string | null | undefined,
): T[] {
  if (!selectedTransactionId) return targets;

  const selectedIndex = targets.findIndex((target) => target.id === selectedTransactionId);
  if (selectedIndex === -1) return targets;

  return [
    ...targets.slice(0, selectedIndex),
    ...targets.slice(selectedIndex + 1),
    targets[selectedIndex],
  ];
}

export function shouldUpdateFromDelivery(
  state: DeliveryUpdateState,
  destinationTxHash: string | undefined,
): boolean {
  if (!state.hasUpdated) return true;
  return !!destinationTxHash && !state.hasBackfilledHash;
}
