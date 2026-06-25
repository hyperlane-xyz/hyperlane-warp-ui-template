import { describe, expect, test } from 'vitest';

import { UnifiedRouteMode } from './tokens/routes';
import type { UnifiedToken } from './tokens/types';
import type { UnifiedFormValues } from './types';
import { getUnifiedBasicSubmitErrors } from './validation';

const values: UnifiedFormValues = {
  originTokenKey: 'origin',
  destinationTokenKey: 'destination',
  amount: '1',
  recipient: '',
  slippageBps: 100,
};

function createUnifiedToken(args: Partial<UnifiedToken> = {}): UnifiedToken {
  return {
    key: 'origin',
    chainName: 'ethereum',
    chainId: 1,
    addressOrDenom: '0x0000000000000000000000000000000000000001',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    isNative: false,
    capabilities: { bridge: true, swap: false },
    ...args,
  };
}

describe('getUnifiedBasicSubmitErrors', () => {
  test('requires an origin token before reporting route availability', () => {
    expect(
      getUnifiedBasicSubmitErrors({
        routeMode: null,
        values: { ...values, originTokenKey: undefined },
        originToken: undefined,
        destinationToken: createUnifiedToken({ key: 'destination', chainName: 'base' }),
        recipient: '0x123',
        hasSwapRoute: false,
      }),
    ).toEqual({ originTokenKey: 'Origin token is required' });
  });

  test('requires a destination token before reporting route availability', () => {
    expect(
      getUnifiedBasicSubmitErrors({
        routeMode: null,
        values: { ...values, destinationTokenKey: undefined },
        originToken: createUnifiedToken(),
        destinationToken: undefined,
        recipient: '0x123',
        hasSwapRoute: false,
      }),
    ).toEqual({ destinationTokenKey: 'Destination token is required' });
  });

  test('reports unsupported route after both tokens are selected', () => {
    expect(
      getUnifiedBasicSubmitErrors({
        routeMode: null,
        values,
        originToken: createUnifiedToken(),
        destinationToken: createUnifiedToken({ key: 'destination', chainName: 'base' }),
        recipient: '0x123',
        hasSwapRoute: false,
      }),
    ).toEqual({ destinationTokenKey: 'Route is not supported' });
  });

  test('requires a valid positive amount', () => {
    expect(
      getUnifiedBasicSubmitErrors({
        routeMode: UnifiedRouteMode.Bridge,
        values: { ...values, amount: '0' },
        originToken: createUnifiedToken(),
        destinationToken: createUnifiedToken({ key: 'destination', chainName: 'base' }),
        recipient: '0x123',
        hasSwapRoute: false,
      }),
    ).toEqual({ amount: 'Invalid amount' });
  });

  test('requires a recipient', () => {
    expect(
      getUnifiedBasicSubmitErrors({
        routeMode: UnifiedRouteMode.Bridge,
        values,
        originToken: createUnifiedToken(),
        destinationToken: createUnifiedToken({ key: 'destination', chainName: 'base' }),
        recipient: '',
        hasSwapRoute: false,
      }),
    ).toEqual({ recipient: 'Invalid recipient' });
  });

  test('allows valid swap route inputs', () => {
    expect(
      getUnifiedBasicSubmitErrors({
        routeMode: UnifiedRouteMode.Swap,
        values,
        originToken: createUnifiedToken(),
        destinationToken: createUnifiedToken({ key: 'destination', chainName: 'base' }),
        recipient: '0x123',
        hasSwapRoute: true,
      }),
    ).toBeNull();
  });
});
