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

  const knownLabels = messages.map((msg) => getKnownMessageLabel(msg, bridgeRouters));
  const fallbackBridgeIndex = getFallbackBridgeIndex(knownLabels, route);
  const fallbackRevealIndex = route?.callCommitment ? messages.length - 1 : -1;

  return messages.map((msg, index) => {
    const knownLabel = knownLabels[index];
    if (knownLabel) return { msgId: msg.msgId, label: knownLabel };

    if (index === fallbackBridgeIndex) {
      return { msgId: msg.msgId, label: 'bridge' as const };
    }

    if (index === fallbackRevealIndex) return { msgId: msg.msgId, label: 'reveal' as const };

    if (msg.sender || msg.body) {
      logger.warn('Unexpected transfer message shape; labeling as commit', {
        msgId: msg.msgId,
        sender: msg.sender,
      });
    }
    return { msgId: msg.msgId, label: 'commit' as const };
  });
}

export function normalizeLabeledTransferMessages(msgIds: LabeledMsgId[] | undefined) {
  if (!msgIds?.length) return msgIds;
  if (msgIds.some((msg) => msg.label === 'bridge' || msg.label === 'warp')) return msgIds;
  if (!msgIds.some((msg) => msg.label === 'reveal')) return msgIds;

  const bridgeIndex = msgIds.findIndex((msg) => msg.label === 'commit');
  if (bridgeIndex < 0) return msgIds;

  return msgIds.map((msg, index) =>
    index === bridgeIndex ? { ...msg, label: 'bridge' as const } : msg,
  );
}

function getKnownMessageLabel(
  msg: ParsedTransferMessage,
  bridgeRouters: Set<string>,
): LabeledMsgId['label'] | null {
  if (msg.sender && bridgeRouters.has(normalizeComparableAddress(msg.sender))) {
    return 'bridge';
  }

  if (isWarpRouteMessageBody(msg.body)) return 'bridge';

  return getCcsMessageLabel(msg.body ?? '');
}

function getFallbackBridgeIndex(
  knownLabels: Array<LabeledMsgId['label'] | null>,
  route?: RouteResponse,
) {
  const unknownIndexes = knownLabels.flatMap((label, index) => (label ? [] : [index]));
  if (unknownIndexes.length === 1) return unknownIndexes[0];

  // Some non-EVM SDK extractors only return message IDs. For CCS routes the
  // bridge message is emitted before the commit/reveal messages.
  if (route?.callCommitment && unknownIndexes.length >= 3) return unknownIndexes[0];

  return -1;
}

function isWarpRouteMessageBody(body: string | null | undefined) {
  // Warp route bodies are recipient bytes32 + amount uint256.
  return !!body && /^0x[0-9a-fA-F]{128}$/.test(body);
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
