import { IToken, MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { track } from '@vercel/analytics';
import { config } from '../../consts/config';
import { EVENT_NAME, EventProperties } from './types';

const sessionId =
  crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export function trackEvent<T extends EVENT_NAME>(eventName: T, properties: EventProperties[T]) {
  if (!config.enableTrackingEvents) return;

  // take into consideration vercel only allows up to 8 properties
  track(eventName, {
    sessionId,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    ...properties,
  });
}

export function trackTokenSelectionEvent(
  token: IToken,
  origin: string,
  destination: string,
  multiProvider: MultiProtocolProvider,
) {
  const originChainId = multiProvider.getChainId(origin);
  const destinationChainId = multiProvider.getChainId(destination);
  trackEvent(EVENT_NAME.TOKEN_SELECTION, {
    standard: token.standard,
    tokenAddress: token.addressOrDenom,
    tokenSymbol: token.symbol,
    chains: `${origin}|${originChainId}|${destination}|${destinationChainId}`,
  });
}
