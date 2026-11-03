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
): { owner?: string; ism: string; salt?: string; commitment: string } | undefined {
  if (!body) return undefined;
  const word = (byte: number) => `0x${body.slice(2 + byte * 2, 2 + (byte + 32) * 2)}`;
  if (/^0x01[0-9a-fA-F]{256}$/.test(body))
    return { owner: word(1), ism: word(33), salt: word(65), commitment: word(97) };
  if (/^0x02[0-9a-fA-F]{128}$/.test(body)) return { ism: word(1), commitment: word(33) };
  return undefined;
}
