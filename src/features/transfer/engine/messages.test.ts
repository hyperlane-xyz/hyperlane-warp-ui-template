import { describe, expect, test } from 'vitest';

import type { RouteResponse } from '../../api/types';
import { getTransferDeliveryMsgId } from '../../messages/utils';
import { labelTransferMessages } from './messages';

const BRIDGE_ID = `0x${'11'.repeat(32)}`;
const COMMIT_ID = `0x${'22'.repeat(32)}`;
const REVEAL_ID = `0x${'33'.repeat(32)}`;

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

  test('labels the last SDK-discovered message as reveal for destination swap routes', () => {
    const labels = labelTransferMessages(
      [{ msgId: BRIDGE_ID }, { msgId: COMMIT_ID }, { msgId: REVEAL_ID }],
      routeWithDestinationSwap(),
    );

    expect(labels).toEqual([
      { msgId: BRIDGE_ID, label: 'commit' },
      { msgId: COMMIT_ID, label: 'commit' },
      { msgId: REVEAL_ID, label: 'reveal' },
    ]);
    expect(getTransferDeliveryMsgId(labels)).toBe(REVEAL_ID);
  });

  test('labels EVM-discovered bridge and CCS messages for destination swap routes', () => {
    const labels = labelTransferMessages(
      [
        { msgId: BRIDGE_ID, sender: '0x0000000000000000000000000000000000000001' },
        { msgId: COMMIT_ID, body: '0x01abcdef' },
        { msgId: REVEAL_ID, body: '0x02abcdef' },
      ],
      routeWithDestinationSwap(),
    );

    expect(labels).toEqual([
      { msgId: BRIDGE_ID, label: 'warp' },
      { msgId: COMMIT_ID, label: 'commit' },
      { msgId: REVEAL_ID, label: 'reveal' },
    ]);
    expect(getTransferDeliveryMsgId(labels)).toBe(REVEAL_ID);
  });
  test('labels route router messages as warp', () => {
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
    ).toEqual([{ msgId: BRIDGE_ID, label: 'warp' }]);
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
