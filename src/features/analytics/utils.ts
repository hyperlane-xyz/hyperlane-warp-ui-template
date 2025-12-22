import { IToken, MultiProtocolProvider, Token, WarpCore } from '@hyperlane-xyz/sdk';
import { objLength, ProtocolType } from '@hyperlane-xyz/utils';
import { AccountInfo, getAccountAddressAndPubKey } from '@hyperlane-xyz/widgets';
import { track } from '@vercel/analytics';
import { config } from '../../consts/config';
import { getTokenKey } from '../tokens/utils';
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
const SKIPPED_ERRORS = [
  'Token is required',
  'Origin token is required',
  'Destination token is required',
  'Invalid amount',
];

export function trackTransactionFailedEvent(
  errors: Record<string, string> | null,
  warpCore: WarpCore,
  { originTokenKey, destinationTokenKey, amount, recipient }: TransferFormValues,
  accounts: Record<ProtocolType, AccountInfo>,
  overrideToken: Token | null,
) {
  if (!errors || objLength(errors) < 1) return;

  const firstError = `${Object.values(errors)[0]}` || 'Unknown error';

  if (SKIPPED_ERRORS.includes(firstError)) return;

  // Find token from warpCore tokens by key
  const token = overrideToken || warpCore.tokens.find((t) => getTokenKey(t) === originTokenKey);
  if (!token) return;

  const origin = token.chainName;
  const { address } = getAccountAddressAndPubKey(warpCore.multiProvider, origin, accounts);

  // Find destination token to get destination chain
  const destToken = warpCore.tokens.find((t) => getTokenKey(t) === destinationTokenKey);
  if (!destToken) return;
  const destination = destToken.chainName;

  const originChainId = warpCore.multiProvider.tryGetChainId(origin);
  const destinationChainId = destination ? warpCore.multiProvider.tryGetChainId(destination) : null;
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
