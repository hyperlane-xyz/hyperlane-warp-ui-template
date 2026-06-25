import { describe, expect, test } from 'vitest';

import { SwapStatus, type SwapHistoryItem } from '../swap/types';
import { getSwapDeliveryMsgId, getSwapHistoryMessageIds } from './utils';

describe('message utils', () => {
  test('prefers reveal then warp message ids for swap delivery', () => {
    expect(
      getSwapDeliveryMsgId([
        { label: 'commit', msgId: '0xcommit' },
        { label: 'warp', msgId: '0xwarp' },
        { label: 'reveal', msgId: '0xreveal' },
      ]),
    ).toBe('0xreveal');

    expect(
      getSwapDeliveryMsgId([
        { label: 'commit', msgId: '0xcommit' },
        { label: 'warp', msgId: '0xwarp' },
      ]),
    ).toBe('0xwarp');
  });

  test('collects swap message ids before swaps are final', () => {
    const swaps: Array<Pick<SwapHistoryItem, 'msgIds' | 'status'>> = [
      {
        status: SwapStatus.Bridging,
        msgIds: [{ label: 'warp', msgId: '0xABC' }],
      },
      {
        status: SwapStatus.ConfirmingDestination,
        msgIds: [{ label: 'reveal', msgId: '0xdef' }],
      },
      {
        status: SwapStatus.ConfirmedDestination,
        msgIds: [{ label: 'warp', msgId: '0x123' }],
      },
      {
        status: SwapStatus.Failed,
      },
    ];

    expect([...getSwapHistoryMessageIds(swaps)].sort()).toEqual(['0x123', '0xabc', '0xdef']);
  });
});
