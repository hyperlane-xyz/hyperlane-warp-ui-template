import { describe, expect, test } from 'vitest';

import type { RouteResponse } from '../../api/types';
import { getTransferDeliveryMsgId } from '../../messages/utils';
import { labelTransferMessages, normalizeLabeledTransferMessages } from './messages';

const BRIDGE_ID = `0x${'11'.repeat(32)}`;
const COMMIT_ID = `0x${'22'.repeat(32)}`;
const REVEAL_ID = `0x${'33'.repeat(32)}`;
const WARP_BODY = `0x${'00'.repeat(12)}${'44'.repeat(20)}${'00'.repeat(31)}01`;

describe('labelTransferMessages', () => {
  test('labels a single discovered message as bridge', () => {
    expect(labelTransferMessages([{ msgId: BRIDGE_ID }])).toEqual([
      { msgId: BRIDGE_ID, label: 'bridge' },
    ]);
  });

  test('labels CCS commit and reveal messages from bodies', () => {
    expect(
      labelTransferMessages([
        { msgId: COMMIT_ID, body: '0x01abcdef' },
        { msgId: REVEAL_ID, body: '0x02abcdef' },
      ]),
    ).toEqual([
      { msgId: COMMIT_ID, label: 'commit' },
      { msgId: REVEAL_ID, label: 'reveal' },
    ]);
  });

  test('labels SDK-discovered messages by order for destination swap routes', () => {
    const labels = labelTransferMessages(
      [{ msgId: BRIDGE_ID }, { msgId: COMMIT_ID }, { msgId: REVEAL_ID }],
      routeWithDestinationSwap(),
    );

    expect(labels).toEqual([
      { msgId: BRIDGE_ID, label: 'bridge' },
      { msgId: COMMIT_ID, label: 'commit' },
      { msgId: REVEAL_ID, label: 'reveal' },
    ]);
    expect(getTransferDeliveryMsgId(labels)).toBe(REVEAL_ID);
  });

  test('labels EVM-discovered bridge and CCS messages for destination swap routes', () => {
    const labels = labelTransferMessages(
      [
        {
          msgId: BRIDGE_ID,
          sender: '0x0000000000000000000000000000000000000000000000000000000000000001',
        },
        { msgId: COMMIT_ID, body: '0x01abcdef' },
        { msgId: REVEAL_ID, body: '0x02abcdef' },
      ],
      routeWithDestinationSwap(),
    );

    expect(labels).toEqual([
      { msgId: BRIDGE_ID, label: 'bridge' },
      { msgId: COMMIT_ID, label: 'commit' },
      { msgId: REVEAL_ID, label: 'reveal' },
    ]);
    expect(getTransferDeliveryMsgId(labels)).toBe(REVEAL_ID);
  });
  test('labels route router messages as bridge', () => {
    expect(
      labelTransferMessages(
        [{ msgId: BRIDGE_ID, sender: 'CWSVXTp2LadAE77Lk511ntA5jZNVgqiUXkWzUxjHtmeh' }],
        {
          steps: [
            {
              type: 'bridge',
              router: 'CWSVXTp2LadAE77Lk511ntA5jZNVgqiUXkWzUxjHtmeh',
            },
          ],
        } as RouteResponse,
      ),
    ).toEqual([{ msgId: BRIDGE_ID, label: 'bridge' }]);
  });

  test('keeps non-hex router address comparison case-sensitive', () => {
    expect(
      labelTransferMessages(
        [{ msgId: BRIDGE_ID, sender: 'CWSVXTp2LadAE77Lk511ntA5jZNVgqiUXkWzUxjHtmeh' }],
        {
          steps: [
            {
              type: 'bridge',
              router: 'cwsvxtp2ladae77lk511nta5jznvgqiuxkwzwxjhtmeh',
            },
          ],
        } as RouteResponse,
      ),
    ).toEqual([{ msgId: BRIDGE_ID, label: 'bridge' }]);
  });

  test('labels warp route bodies as bridge even without route metadata', () => {
    expect(
      labelTransferMessages([
        { msgId: BRIDGE_ID, body: WARP_BODY },
        { msgId: COMMIT_ID, body: '0x01abcdef' },
        { msgId: REVEAL_ID, body: '0x02abcdef' },
      ]),
    ).toEqual([
      { msgId: BRIDGE_ID, label: 'bridge' },
      { msgId: COMMIT_ID, label: 'commit' },
      { msgId: REVEAL_ID, label: 'reveal' },
    ]);
  });

  test('normalizes stale CCS labels without changing delivery target', () => {
    const labels = normalizeLabeledTransferMessages([
      { msgId: BRIDGE_ID, label: 'commit' },
      { msgId: COMMIT_ID, label: 'commit' },
      { msgId: REVEAL_ID, label: 'reveal' },
    ]);

    expect(labels).toEqual([
      { msgId: BRIDGE_ID, label: 'bridge' },
      { msgId: COMMIT_ID, label: 'commit' },
      { msgId: REVEAL_ID, label: 'reveal' },
    ]);
    expect(getTransferDeliveryMsgId(labels)).toBe(REVEAL_ID);
  });
});

function routeWithDestinationSwap(): RouteResponse {
  return {
    steps: [
      {
        type: 'bridge',
        router: '0x0000000000000000000000000000000000000001',
      },
      {
        type: 'swap',
        chain: 2,
      },
    ],
    callCommitment: {
      version: 1,
    },
  } as RouteResponse;
}
