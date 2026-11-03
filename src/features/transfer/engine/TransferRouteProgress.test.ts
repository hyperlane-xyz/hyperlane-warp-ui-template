import { describe, expect, test } from 'vitest';

import type { QuoteStep } from '../../api/types';
import { ProgressState } from '../../messages/progress';
import { getTransferRouteProgress, getSwapStages } from './TransferRouteProgress';
import { TransferStatus, type TransferHistoryItem } from './types';

const address = '0x1111111111111111111111111111111111111111';
const bridge: QuoteStep = {
  type: 'bridge',
  chain: 1,
  destChain: 2,
  asset: address,
  router: address,
  amountIn: '1',
  amountOut: '1',
  fee: {
    tokenFee: '0',
    igpToken: address,
    igpAmount: '0',
    igpIncludedInAmountIn: false,
    localNativeFee: '0',
  },
};
function swap(chain: number): QuoteStep {
  return {
    type: 'swap',
    chain,
    dex: 'test',
    tokenIn: address,
    tokenOut: address,
    amountIn: '1',
    amountOut: '1',
    path: [address],
    poolCount: 1,
  };
}
function transfer(overrides: Partial<TransferHistoryItem> = {}): TransferHistoryItem {
  return {
    status: TransferStatus.Bridging,
    timestamp: 1,
    srcChain: 1,
    dstChain: 2,
    srcToken: address,
    dstToken: address,
    amountIn: '1',
    amountOut: '1',
    sender: address,
    recipient: address,
    routeSteps: [swap(1), bridge, swap(2)],
    ...overrides,
  };
}

describe('Transfer route stages', () => {
  test.each([
    { origin: false, destination: false },
    { origin: true, destination: false },
    { origin: false, destination: true },
    { origin: true, destination: true },
  ])('only includes actual swaps: %j', (swaps) => {
    const steps = [
      ...(swaps.origin ? [swap(1)] : []),
      bridge,
      ...(swaps.destination ? [swap(2)] : []),
    ];
    const swapStages = getSwapStages(steps, 1, 2);
    expect(swapStages).toEqual(swaps.origin || swaps.destination ? swaps : undefined);
    const stages = getTransferRouteProgress({
      transfer: transfer({ routeSteps: steps }),
      fundsAvailable: false,
    });
    expect(stages.map((stage) => stage.label)).toEqual(
      swaps.origin || swaps.destination
        ? [
            ...(swaps.origin ? ['Origin swap'] : []),
            'Transfer',
            ...(swaps.destination ? ['Destination swap'] : []),
          ]
        : ['Transfer'],
    );
  });

  test('same-chain swaps show one swap', () => {
    expect(getSwapStages([swap(1)], 1, 1)).toBeUndefined();
    expect(
      getTransferRouteProgress({
        transfer: transfer({ dstChain: 1, routeSteps: [swap(1)] }),
        fundsAvailable: true,
      }).map((stage) => stage.label),
    ).toEqual(['Swap']);
  });

  test.each([
    TransferStatus.Preparing,
    TransferStatus.SigningApprove,
    TransferStatus.ConfirmingApprove,
    TransferStatus.CreatingTxs,
    TransferStatus.SigningTransfer,
  ])('route execution stays idle before submission: %s', (status) => {
    const stages = getTransferRouteProgress({
      transfer: transfer({ status }),
      fundsAvailable: false,
    });
    expect(stages.every((stage) => stage.state === ProgressState.Pending && !stage.active)).toBe(
      true,
    );
    expect(stages.every((stage) => stage.description === 'Waiting')).toBe(true);
  });

  test('origin swap stays incomplete until origin inclusion', () => {
    const stages = getTransferRouteProgress({
      transfer: transfer({ status: TransferStatus.ConfirmingOrigin }),
      fundsAvailable: false,
    });
    expect(stages.map((stage) => stage.description)).toEqual(['Confirming', 'Waiting', 'Waiting']);
    expect(stages.every((stage) => stage.state === ProgressState.Pending)).toBe(true);
  });

  test('bridge delivery does not imply destination swap success', () => {
    const props = { transfer: transfer(), bridgeDelivered: true, fundsAvailable: false };
    expect(getTransferRouteProgress(props).map((stage) => stage.description)).toEqual([
      'Complete',
      'Delivered',
      'Awaiting authorization',
    ]);
    expect(getTransferRouteProgress({ ...props, executionDelivered: true })[2].description).toBe(
      'Checking outcome',
    );
    expect(
      getTransferRouteProgress({ ...props, executionDelivered: true, fundsAvailable: true })[2]
        .description,
    ).toBe('Complete');
  });

  test.each([
    TransferStatus.DestFailed,
    TransferStatus.DestTransferFailed,
    TransferStatus.FailedRecovered,
  ])('destination failure preserves successful earlier stages: %s', (status) => {
    const stages = getTransferRouteProgress({
      transfer: transfer({ status }),
      bridgeDelivered: true,
      executionDelivered: true,
      fundsAvailable: false,
    });
    expect(stages.map((stage) => stage.state)).toEqual([
      ProgressState.Confirmed,
      ProgressState.Confirmed,
      ProgressState.Failed,
    ]);
  });

  test('failure before dispatch does not mark later stages successful', () => {
    const stages = getTransferRouteProgress({
      transfer: transfer({ status: TransferStatus.Failed }),
      fundsAvailable: false,
    });
    expect(stages.map((stage) => stage.description)).toEqual([
      'Not completed',
      'Stopped',
      'Not started',
    ]);
  });

  test('verified funds availability completes the route even when bridge indexing lags', () => {
    const stages = getTransferRouteProgress({
      transfer: transfer(),
      executionDelivered: true,
      fundsAvailable: true,
    });
    expect(stages.every((stage) => stage.state === ProgressState.Confirmed)).toBe(true);
  });

  test('losing delivery evidence clears completion', () => {
    const stages = getTransferRouteProgress({
      transfer: transfer(),
      bridgeDelivered: false,
      executionDelivered: false,
      fundsAvailable: false,
    });
    expect(stages.map((stage) => stage.description)).toEqual([
      'Complete',
      'Awaiting delivery',
      'Waiting',
    ]);
  });

  test('legacy records show a transfer without inventing swap details', () => {
    const stages = getTransferRouteProgress({
      transfer: transfer({
        routeSteps: undefined,
        destinationOutcome: { bridgeToken: address, dstToken: address },
      }),
      fundsAvailable: false,
    });
    expect(stages.map((stage) => stage.label)).toEqual(['Transfer']);
  });
});
