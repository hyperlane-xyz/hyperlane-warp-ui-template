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
