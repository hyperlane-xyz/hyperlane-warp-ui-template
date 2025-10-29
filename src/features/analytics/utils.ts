import { IToken, MultiProtocolProvider, Token, WarpCore } from '@hyperlane-xyz/sdk';
import { objLength, ProtocolType } from '@hyperlane-xyz/utils';
import { AccountInfo, getAccountAddressAndPubKey } from '@hyperlane-xyz/widgets';
import { track } from '@vercel/analytics';
import { config } from '../../consts/config';
import { getTokenByIndex } from '../tokens/hooks';
import { TransferFormValues } from '../transfer/types';
import { EVENT_NAME, EventProperties } from './types';

export function trackEvent<T extends EVENT_NAME>(eventName: T, properties: EventProperties[T]) {
  if (!config.enableTrackingEvents) return;

  // take into consideration vercel only allows up to 8 properties
  track(eventName, {
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
  values: TransferFormValues,
  accounts: Record<ProtocolType, AccountInfo>,
  overrideToken: Token | null,
) {
  if (!errors || objLength(errors) < 1) return;

  const firstError = `${Object.values(errors)[0]}` || 'Unknown error';

  if (SKIPPED_ERRORS.includes(firstError)) return;

  const { address } = getAccountAddressAndPubKey(warpCore.multiProvider, values.origin, accounts);
  const token = overrideToken || getTokenByIndex(warpCore, values.tokenIndex);

  if (!token) return;

  return trackEvent(EVENT_NAME.TRANSACTION_SUBMISSION_FAILED, {
    amount: values.amount,
    destination: values.destination,
    origin: values.origin,
    walletAddress: address || null,
    tokenAddress: token.addressOrDenom,
    tokenSymbol: token.symbol,
    recipient: values.recipient,
    error: firstError,
  });
}
