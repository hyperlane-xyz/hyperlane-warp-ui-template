import { describe, expect, test } from 'vitest';

import type { LabeledMsgId } from '../transfer/engine/types';
import { getTransferDeliveryMsgId } from './utils';

const BRIDGE_ID = `0x${'11'.repeat(32)}`;
const REVEAL_ID = `0x${'22'.repeat(32)}`;
const WARP_ID = `0x${'33'.repeat(32)}`;

describe('getTransferDeliveryMsgId', () => {
  test('uses bridge message when route has no reveal message', () => {
    expect(getTransferDeliveryMsgId([msg(BRIDGE_ID, 'bridge')])).toBe(BRIDGE_ID);
  });

  test('prefers reveal over bridge and warp messages', () => {
    expect(
      getTransferDeliveryMsgId([
        msg(WARP_ID, 'warp'),
        msg(BRIDGE_ID, 'bridge'),
        msg(REVEAL_ID, 'reveal'),
      ]),
    ).toBe(REVEAL_ID);
  });
});

function msg(msgId: string, label: LabeledMsgId['label']): LabeledMsgId {
  return { msgId, label };
}
