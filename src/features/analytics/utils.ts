import { track } from '@vercel/analytics';

import { config } from '../../consts/config';
import type { UiToken } from '../tokens/types';
import type { TransferFormValues } from '../transfer/engine/types';
import type { TransferFormErrors } from '../transfer/engine/validate';
import { EVENT_NAME, EventProperties } from './types';

const sessionId =
  crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export function trackEvent<T extends EVENT_NAME>(eventName: T, properties: EventProperties[T]) {
  if (!config.enableTrackingEvents) return;

  // take into consideration vercel only allows up to 8 properties
  track(eventName, {
    sessionId,
    ...properties,
  });
}

export function getAnalyticsChains(
  srcChain: Pick<UiToken, 'chainName' | 'chainId'>,
  dstChain: Pick<UiToken, 'chainName' | 'chainId'>,
  transactionType?: AnalyticsTransactionType,
) {
  const chains = `${srcChain.chainName}|${srcChain.chainId}|${dstChain.chainName}|${dstChain.chainId}`;
  return transactionType ? `${chains}|${transactionType}` : chains;
}

export type AnalyticsTransactionType = 'bridge' | 'swap';

export function getAnalyticsToken(token: Pick<UiToken, 'address' | 'symbol'>) {
  return `${token.address}|${token.symbol}`;
}

export function trackTokenSelectionEvent(
  tokenType: string,
  originToken: UiToken | undefined,
  destinationToken: UiToken | undefined,
) {
  if (!originToken || !destinationToken) return;

  trackEvent(EVENT_NAME.TOKEN_SELECTED, {
    tokenType,
    originToken: getAnalyticsToken(originToken),
    destinationToken: getAnalyticsToken(destinationToken),
    origin: originToken.chainName,
    destination: destinationToken.chainName,
    originChainId: originToken.chainId,
    destinationChainId: destinationToken.chainId,
  });
}

export function trackChainSelectionEvent(
  chainType: string,
  chain: { name: string; chainId: ChainId } | null,
  previousChain: { name: string; chainId: ChainId } | null,
) {
  trackEvent(EVENT_NAME.CHAIN_SELECTED, {
    chainType,
    chainId: chain?.chainId ?? null,
    chainName: chain?.name ?? null,
    previousChainId: previousChain?.chainId ?? null,
    previousChainName: previousChain?.name ?? null,
  });
}

const SKIPPED_VALIDATION_ERRORS = [
  'Origin token required',
  'Destination token required',
  'Enter an amount',
  'Enter a positive amount',
  'Invalid amount',
];

export function trackTransferValidationFailed({
  errors,
  values,
  srcToken,
  dstToken,
  sender,
  recipient,
}: {
  errors: TransferFormErrors | null;
  values: TransferFormValues;
  srcToken: UiToken | undefined;
  dstToken: UiToken | undefined;
  sender: string | undefined;
  recipient: string;
}) {
  if (!errors || !Object.keys(errors).length || !srcToken || !dstToken) return;

  const firstError = `${Object.values(errors)[0]}` || 'Unknown error';
  if (SKIPPED_VALIDATION_ERRORS.includes(firstError)) return;

  trackEvent(EVENT_NAME.TRANSACTION_SUBMISSION_FAILED, {
    amount: values.amount,
    chains: getAnalyticsChains(srcToken, dstToken),
    walletAddress: sender || null,
    originToken: getAnalyticsToken(srcToken),
    destinationToken: getAnalyticsToken(dstToken),
    recipient,
    error: firstError,
  });
}

export function trackUnsupportedRouteEvent(
  originToken: UiToken | undefined,
  destinationToken: UiToken | undefined,
) {
  if (!originToken || !destinationToken) return;

  trackEvent(EVENT_NAME.UNSUPPORTED_ROUTE_SELECTED, {
    originToken: getAnalyticsToken(originToken),
    destinationToken: getAnalyticsToken(destinationToken),
    origin: originToken.chainName,
    destination: destinationToken.chainName,
    originChainId: originToken.chainId,
    destinationChainId: destinationToken.chainId,
  });
}
