import type { QuoteRejection } from '../../api/types';

const REJECTION_MESSAGES: Record<string, string> = {
  insufficient_input_for_bridge_fee: 'Amount is too small to cover bridge fees',
  insufficient_destination_collateral: 'Insufficient destination liquidity',
  collateral_unavailable: 'Destination liquidity is temporarily unavailable',
  collateral_config_mismatch: 'Route liquidity configuration is unavailable',
  quote_failed: 'Route quote is temporarily unavailable',
  fee_quote_unavailable: 'Route quote is temporarily unavailable',
  transaction_encoding_failed: 'Unable to prepare route transaction',
};

const REJECTION_PRIORITY = [
  'insufficient_input_for_bridge_fee',
  'insufficient_destination_collateral',
  'collateral_unavailable',
  'collateral_config_mismatch',
  'transaction_encoding_failed',
  'fee_quote_unavailable',
  'quote_failed',
] as const;

export function emptyRouteMessageForRejections(
  rejections: QuoteRejection[] | undefined,
): string | undefined {
  if (!rejections?.length) return undefined;
  for (const code of REJECTION_PRIORITY) {
    if (rejections.some((rejection) => rejection.code === code)) return REJECTION_MESSAGES[code];
  }
  return 'Route is temporarily unavailable';
}
