import type { ChainMetadata } from '@hyperlane-xyz/sdk';
import { parseWarpRouteMessage } from '@hyperlane-xyz/utils';

import type { LabeledMsgId } from '../transfer/engine/types';

export enum ProgressState {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Unavailable = 'unavailable',
  Failed = 'failed',
}

export interface ConfirmationProgress {
  state: ProgressState;
  included?: boolean;
  confirmations?: number;
  required?: number;
  reason?: string;
}

export function confirmationProgress(
  height: number,
  head: number,
  required: number,
): ConfirmationProgress {
  const confirmations = Math.max(0, head - height);
  return {
    state:
      head >= height && confirmations >= required ? ProgressState.Confirmed : ProgressState.Pending,
    included: true,
    confirmations,
    required,
  };
}

export function estimateConfirmationSeconds(
  progress: ConfirmationProgress | undefined,
  blockTime: number | undefined,
): number | undefined {
  if (progress?.state !== ProgressState.Pending || blockTime == null || blockTime <= 0)
    return undefined;
  const { confirmations, required } = progress;
  if (
    confirmations == null ||
    required == null ||
    !Number.isFinite(confirmations) ||
    !Number.isFinite(required) ||
    confirmations < 0 ||
    required <= confirmations
  )
    return undefined;
  const seconds = (required - confirmations) * blockTime;
  return Number.isFinite(seconds) ? seconds : undefined;
}

export function estimateDeliverySeconds(
  blocks: ChainMetadata['blocks'],
  progress?: ConfirmationProgress,
): number | undefined {
  if (progress?.state === ProgressState.Failed) return undefined;
  const blockTime = blocks?.estimateBlockTime;
  const confirmations =
    typeof blocks?.reorgPeriod === 'number' ? blocks.reorgPeriod : blocks?.confirmations;
  if (
    blockTime == null ||
    !Number.isFinite(blockTime) ||
    blockTime <= 0 ||
    confirmations == null ||
    !Number.isFinite(confirmations) ||
    confirmations < 0
  )
    return undefined;
  const originSeconds =
    progress?.state === ProgressState.Confirmed
      ? 0
      : (estimateConfirmationSeconds(progress, blockTime) ?? confirmations * blockTime);
  const seconds = originSeconds + 5;
  return Number.isFinite(seconds) ? seconds : undefined;
}

export function formatEstimatedTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid estimated duration');
  const roundedSeconds = Math.ceil(seconds);
  if (roundedSeconds < 60) return `~${roundedSeconds}s`;
  if (roundedSeconds < 3600) return `~${Math.ceil(roundedSeconds / 60)} min`;
  return `~${Math.ceil(roundedSeconds / 3600)} hr`;
}

export function decodeTransferBody(
  message: Pick<LabeledMsgId, 'label'> & { body?: string },
): { recipient: string; amount: string } | undefined {
  if (!message.body || !['bridge', 'warp'].includes(message.label)) return undefined;
  if (!/^0x[0-9a-fA-F]{128,}$/.test(message.body) || message.body.length % 2 !== 0)
    return undefined;
  const parsed = parseWarpRouteMessage(message.body);
  return { recipient: parsed.recipient, amount: parsed.amount.toString() };
}

/** Layout from InterchainAccountMessage.sol. Unknown/extended formats stay raw. */
export function decodeAuthorizationBody(
  body: string | null | undefined,
): { ism: string; commitment: string } | undefined {
  if (!body) return undefined;
  const word = (byte: number) => `0x${body.slice(2 + byte * 2, 2 + (byte + 32) * 2)}`;
  if (/^0x01[0-9a-fA-F]{256}$/.test(body)) return { ism: word(33), commitment: word(97) };
  if (/^0x02[0-9a-fA-F]{128}$/.test(body)) return { ism: word(1), commitment: word(33) };
  return undefined;
}
