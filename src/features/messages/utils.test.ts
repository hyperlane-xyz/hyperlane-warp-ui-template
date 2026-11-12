import { describe, expect, test } from 'vitest';

import type { QuoteStep } from '../api/types';
import type { LabeledMsgId } from '../transfer/engine/types';
import { getTransferDeliveryMsgId, getTransferOverviewMsgId } from './utils';

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

describe('getTransferOverviewMsgId', () => {
  const transfer = {
    dstChain: 2,
    msgIds: [msg(BRIDGE_ID, 'bridge'), msg(REVEAL_ID, 'reveal')],
  };
  const bridge: QuoteStep = {
    type: 'bridge',
    chain: 1,
    destChain: 2,
    asset: 'token',
    router: 'router',
    amountIn: '1',
    amountOut: '1',
    fee: {
      tokenFee: '0',
      igpToken: 'token',
      igpAmount: '0',
      igpIncludedInAmountIn: false,
      localNativeFee: '0',
    },
  };
  const swap = (chain: number): QuoteStep => ({
    type: 'swap',
    chain,
    dex: 'test',
    tokenIn: 'token',
    tokenOut: 'other-token',
    amountIn: '1',
    amountOut: '1',
    path: ['token', 'other-token'],
    poolCount: 1,
  });

  test('shows value delivery for routes without a destination swap', () => {
    for (const routeSteps of [[bridge], [swap(1), bridge]]) {
      expect(getTransferOverviewMsgId({ ...transfer, routeSteps })).toBe(BRIDGE_ID);
      // Display selection must not change execution/outcome tracking.
      expect(getTransferDeliveryMsgId(transfer.msgIds)).toBe(REVEAL_ID);
    }
  });

  test('shows reveal execution when the destination swaps', () => {
    for (const routeSteps of [
      [bridge, swap(2)],
      [swap(1), bridge, swap(2)],
    ]) {
      expect(getTransferOverviewMsgId({ ...transfer, routeSteps })).toBe(REVEAL_ID);
    }
  });

  test('preserves execution tracking when legacy route details are missing', () => {
    expect(getTransferOverviewMsgId(transfer)).toBe(REVEAL_ID);
    expect(getTransferOverviewMsgId({ ...transfer, routeSteps: [] })).toBe(REVEAL_ID);
    for (const outcome of [
      { destinationOutcome: { bridgeToken: 'token', dstToken: 'other-token' } },
      { solanaDestSwapPda: 'pending-swap' },
    ]) {
      expect(getTransferOverviewMsgId({ ...transfer, ...outcome })).toBe(REVEAL_ID);
      expect(getTransferOverviewMsgId({ ...transfer, routeSteps: [bridge], ...outcome })).toBe(
        REVEAL_ID,
      );
    }
  });

  test('handles warp labels, missing value messages and no dispatched messages', () => {
    const routeSteps = [swap(1), bridge];
    expect(
      getTransferOverviewMsgId({
        ...transfer,
        routeSteps,
        msgIds: [msg(WARP_ID, 'warp'), msg(REVEAL_ID, 'reveal')],
      }),
    ).toBe(WARP_ID);
    expect(
      getTransferOverviewMsgId({ ...transfer, routeSteps, msgIds: [msg(REVEAL_ID, 'reveal')] }),
    ).toBe(REVEAL_ID);
    expect(getTransferOverviewMsgId({ ...transfer, routeSteps, msgIds: [] })).toBeUndefined();
  });
});

function msg(msgId: string, label: LabeledMsgId['label']): LabeledMsgId {
  return { msgId, label };
}
