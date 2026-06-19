import { logger } from '../../../utils/logger';
import type { RouteResponse } from '../../api/types';
import type { LabeledMsgId } from './types';

export interface ParsedTransferMessage {
  msgId: string;
  sender?: string;
  body?: string | null;
}

export function labelTransferMessages(
  messages: ParsedTransferMessage[],
  route?: RouteResponse,
): LabeledMsgId[] {
  if (!messages.length) return [];

  const bridgeRouters = new Set(
    route?.steps
      .filter(
        (s): s is Extract<(typeof route.steps)[number], { type: 'bridge' }> => s.type === 'bridge',
      )
      .map((s) => normalizeComparableAddress(s.router)) ?? [],
  );

  const nonWarp = messages.filter(
    (m) => !m.sender || !bridgeRouters.has(normalizeComparableAddress(m.sender)),
  );
  const revealMsg = nonWarp.at(-1);

  return messages.map((msg) => {
    if (msg.sender && bridgeRouters.has(normalizeComparableAddress(msg.sender))) {
      return { msgId: msg.msgId, label: 'warp' as const };
    }

    const ccsLabel = getCcsMessageLabel(msg.body ?? '');
    if (ccsLabel) return { msgId: msg.msgId, label: ccsLabel };

    if (nonWarp.length === 1 && msg === nonWarp[0]) {
      return { msgId: msg.msgId, label: 'bridge' as const };
    }
    if (msg === revealMsg) return { msgId: msg.msgId, label: 'reveal' as const };

    logger.warn('Unexpected transfer message shape; labeling as commit', {
      msgId: msg.msgId,
      sender: msg.sender,
    });
    return { msgId: msg.msgId, label: 'commit' as const };
  });
}

function getCcsMessageLabel(body: string): LabeledMsgId['label'] | null {
  // CCS message bodies use the first byte as the message type.
  if (body.startsWith('0x01')) return 'commit';
  if (body.startsWith('0x02')) return 'reveal';
  return null;
}

function normalizeComparableAddress(address: string) {
  return address.startsWith('0x') ? address.toLowerCase() : address;
}
