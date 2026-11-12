import { describe, expect, test } from 'vitest';

import type { QuoteRejection } from '../../api/types';
import { emptyRouteMessageForRejections } from './rejections';

function rejection(code: string): QuoteRejection {
  return {
    code,
    message: 'server message',
    srcChain: 1,
    dstChain: 2,
    srcToken: 'source',
    dstToken: 'destination',
    amount: '1',
  };
}

describe('emptyRouteMessageForRejections', () => {
  test.each([
    ['insufficient_input_for_bridge_fee', 'Amount is too small to cover bridge fees'],
    ['insufficient_destination_collateral', 'Insufficient destination liquidity'],
    ['collateral_unavailable', 'Destination liquidity is temporarily unavailable'],
    ['collateral_config_mismatch', 'Route liquidity configuration is unavailable'],
    ['quote_failed', 'Route quote is temporarily unavailable'],
    ['transaction_encoding_failed', 'Unable to prepare route transaction'],
  ])('maps %s to actionable copy', (code, message) => {
    expect(emptyRouteMessageForRejections([rejection(code)])).toBe(message);
  });

  test('does not label an unknown structured failure as unsupported', () => {
    expect(emptyRouteMessageForRejections([rejection('future_failure')])).toBe(
      'Route is temporarily unavailable',
    );
  });
});
