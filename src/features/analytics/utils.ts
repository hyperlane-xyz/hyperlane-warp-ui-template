import { IToken, MultiProtocolProvider, Token, WarpCore } from '@hyperlane-xyz/sdk';
import { objLength, ProtocolType } from '@hyperlane-xyz/utils';
import { AccountInfo, getAccountAddressAndPubKey } from '@hyperlane-xyz/widgets';
import { track } from '@vercel/analytics';
import { config } from '../../consts/config';
import { getTokenByKey } from '../tokens/hooks';
import { TransferFormValues } from '../transfer/types';
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

export function trackTokenSelectionEvent(
  token: IToken,
  origin: string,
  destination: string,
  multiProvider: MultiProtocolProvider,
) {
  const originChainId = multiProvider.getChainId(origin);
  const destinationChainId = multiProvider.getChainId(destination);
  trackEvent(EVENT_NAME.TOKEN_SELECTED, {
    standard: token.standard,
    tokenAddress: token.addressOrDenom,
    tokenSymbol: token.symbol,
    origin,
    destination,
    originChainId,
    destinationChainId,
  });
}

// errors that happen because of form not being filled correctly
const SKIPPED_ERRORS = ['Token is required', 'Invalid amount'];

export function trackTransactionFailedEvent(
  errors: Record<string, string> | null,
  warpCore: WarpCore,
  { tokenKey, origin, destination, amount, recipient }: TransferFormValues,
  accounts: Record<ProtocolType, AccountInfo>,
  overrideToken: Token | null,
) {
  if (!errors || objLength(errors) < 1) return;

  const firstError = `${Object.values(errors)[0]}` || 'Unknown error';

  if (SKIPPED_ERRORS.includes(firstError)) return;

  const { address } = getAccountAddressAndPubKey(warpCore.multiProvider, origin, accounts);
  const token = overrideToken || getTokenByKey(warpCore, tokenKey);

  if (!token) return;

  const originChainId = warpCore.multiProvider.getChainId(origin);
  const destinationChainId = warpCore.multiProvider.getChainId(destination);
  return trackEvent(EVENT_NAME.TRANSACTION_SUBMISSION_FAILED, {
    amount,
    chains: `${origin}|${originChainId}|${destination}|${destinationChainId}`,
    walletAddress: address || null,
    tokenAddress: token.addressOrDenom,
    tokenSymbol: token.symbol,
    recipient,
    error: firstError,
  });
}
