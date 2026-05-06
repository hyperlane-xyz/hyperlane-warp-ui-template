import {
  IToken,
  QuotedCallsParams,
  SubmitQuoteCommand,
  Token,
  TokenAmount,
  TokenPullMode,
  WarpCore,
  computeScopedSalt,
} from '@hyperlane-xyz/sdk';
import { ProtocolType, addressToBytes32, toWei } from '@hyperlane-xyz/utils';
import { useDebounce } from '@hyperlane-xyz/widgets';
import { useAccounts } from '@hyperlane-xyz/widgets/walletIntegrations/accounts';
import { getAccountAddressAndPubKey } from '@hyperlane-xyz/widgets/walletIntegrations/accountUtils';
import { useQuery } from '@tanstack/react-query';
import { type Address, type Hex, toHex } from 'viem';

import { config } from '../../consts/config';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';
import { useWarpCore } from '../tokens/hooks';
import { TransferFormValues } from './types';

const FEE_QUOTE_REFRESH_INTERVAL = 30_000;
// Upstream quote expires at ~5 min; cap consumption at 4 min so a tab that was
// backgrounded past the refetchInterval can't submit on a stale quote between
// returning to focus and the focus-refetch completing.
const MAX_QUOTE_AGE_MS = 4 * 60_000;

interface QuotedCallsFetchResult {
  interchainQuote: TokenAmount;
  localQuote: TokenAmount;
  tokenFeeQuote?: TokenAmount;
  quotedCallsParams: QuotedCallsParams;
  issuedAt: number;
}

export interface QuotedCallsFeeQuotesResult {
  isLoading: boolean;
  fees: {
    interchainQuote: TokenAmount;
    localQuote: TokenAmount;
    tokenFeeQuote?: TokenAmount;
  } | null;
  quotedCallsParams: QuotedCallsParams | null;
  // Submit handlers call this to retrieve quotedCallsParams that may still be
  // in flight. Returns the cached value when settled, or awaits the active
  // fetch otherwise — prevents a click on Send during the first-load /
  // stale-refetch window from silently falling through to plain transferRemote.
  getQuotedCallsParams: () => Promise<QuotedCallsParams | null>;
}

export function useQuotedCallsFeeQuotes(
  { originTokenKey, destinationTokenKey, amount, recipient: formRecipient }: TransferFormValues,
  enabled: boolean,
  originToken: Token | undefined,
  destinationToken: IToken | undefined,
): QuotedCallsFeeQuotesResult {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();
  const chainAddresses = useStore((s) => s.chainAddresses);
  const debouncedAmount = useDebounce(amount, 500);
  const destination = destinationToken?.chainName;

  const { accounts } = useAccounts(multiProvider);
  const { address: sender } = getAccountAddressAndPubKey(
    multiProvider,
    originToken?.chainName,
    accounts,
  );

  const { address: connectedDestAddress } = getAccountAddressAndPubKey(
    multiProvider,
    destinationToken?.chainName,
    accounts,
  );
  const recipient = formRecipient || connectedDestAddress || '';

  const quotedCallsAddress = originToken
    ? chainAddresses[originToken.chainName]?.quotedCalls
    : undefined;

  const isEvm = originToken?.protocol === ProtocolType.Ethereum;
  // TODO: cross-collateral routes need command='transferRemoteTo' + targetRouter
  // wired through to /api/quote. Short-circuit until that's done so they fall
  // through to the onchain quoting path instead of getting an incorrect quote.
  const isCrossCollateral =
    !!originToken &&
    !!destinationToken &&
    warpCore.isCrossCollateralTransfer(originToken, destinationToken);
  const isFormValid = !!(originToken && destination && debouncedAmount && recipient && sender);
  const shouldFetch =
    enabled &&
    isFormValid &&
    isEvm &&
    !isCrossCollateral &&
    !!config.feeQuotingUrl &&
    !!quotedCallsAddress;

  const { isLoading, isFetching, data, refetch } = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps -- queryFn also
    // closes over (warpCore, originToken, destinationToken, destination) which
    // are class instances and can't be safely stringified into a query key.
    // (originToken, destinationToken, destination) identity is covered by the
    // *Key proxies (originTokenKey, destinationTokenKey) already in the key;
    // warpCore is a store singleton that's stable for the session.
    queryKey: [
      'useQuotedCallsFeeQuotes',
      originTokenKey,
      destinationTokenKey,
      // addressOrDenom is the actual router used in the API call; include it so
      // a token swap that keeps the *Key proxy stable still busts the cache.
      originToken?.addressOrDenom,
      destinationToken?.addressOrDenom,
      sender,
      debouncedAmount,
      recipient,
      quotedCallsAddress,
    ],
    queryFn: () =>
      fetchQuotedCallsFees(
        warpCore,
        quotedCallsAddress,
        originToken,
        destinationToken,
        destination,
        sender,
        debouncedAmount,
        recipient,
      ),
    enabled: shouldFetch,
    refetchInterval: FEE_QUOTE_REFRESH_INTERVAL,
  });

  // useQuery keeps `data` after `enabled` flips false (stale form) and after
  // failed refetches (stale issuedAt). Suppress the cached value in both cases
  // so the consumer doesn't replay an expired quote. When stale and a fresh
  // fetch is in flight, report isLoading: isFetching so the form stays in
  // offchain mode; once retries are exhausted (or interval is paused),
  // isFetching → false and the consumer falls back to onchain quoting.
  const isStale = !!data && Date.now() - data.issuedAt > MAX_QUOTE_AGE_MS;
  const effectiveLoading = !shouldFetch || !data || isStale ? isFetching : isLoading;

  const getQuotedCallsParams = async (): Promise<QuotedCallsParams | null> => {
    if (!effectiveLoading) {
      return !shouldFetch || !data || isStale ? null : data.quotedCallsParams;
    }
    const result = await refetch();
    return result.data?.quotedCallsParams ?? null;
  };

  if (!shouldFetch || !data || isStale) {
    return {
      isLoading: effectiveLoading,
      fees: null,
      quotedCallsParams: null,
      getQuotedCallsParams,
    };
  }
  return {
    isLoading,
    fees: {
      interchainQuote: data.interchainQuote,
      localQuote: data.localQuote,
      tokenFeeQuote: data.tokenFeeQuote,
    },
    quotedCallsParams: data.quotedCallsParams,
    getQuotedCallsParams,
  };
}

function generateClientSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function fetchQuotedCallsFees(
  warpCore: WarpCore,
  quotedCallsAddress: Address | undefined,
  originToken: Token | undefined,
  destinationToken: IToken | undefined,
  destination: string | undefined,
  sender: string | undefined,
  amount: string | undefined,
  recipient: string | undefined,
): Promise<QuotedCallsFetchResult | null> {
  if (
    !originToken ||
    !destinationToken ||
    !destination ||
    !sender ||
    !amount ||
    !recipient ||
    !quotedCallsAddress
  )
    return null;

  // Predicate routes take the wrapper path at submit time (see useTokenTransfer
  // where quotedCalls is dropped when an attestation is present). Skip the
  // offchain quote here so ReviewDetails falls back to onchain quoting and
  // previews the same path the user will actually sign. The adapter memoizes
  // the wrapper lookup, so this is one RPC on first quote and free thereafter.
  if (await warpCore.isPredicateSupported(originToken, destination)) return null;

  const amountWei = toWei(amount, originToken.decimals);
  const originTokenAmount = originToken.amount(amountWei);

  // Generate per-attempt salt and scope it to the sender so the on-chain
  // QuotedCalls contract can verify keccak256(msg.sender, clientSalt) == quote.salt.
  const clientSalt = generateClientSalt();
  const salt = computeScopedSalt(sender as Address, clientSalt);

  // Get destination domain ID
  const destinationDomainId = warpCore.multiProvider.getDomainId(destination);

  // Fetch quotes from API proxy
  const recipientBytes32 = addressToBytes32(recipient) as Hex;
  const params = new URLSearchParams({
    command: 'transferRemote',
    origin: originToken.chainName,
    router: originToken.addressOrDenom,
    destination: String(destinationDomainId),
    salt,
    recipient: recipientBytes32,
  });

  logger.debug('Fetching offchain fee quotes');
  const res = await fetch(`/api/quote?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Fee quote proxy failed (${res.status}): ${(body as any).message ?? res.statusText}`,
    );
  }

  const { quotes } = (await res.json()) as { quotes: SubmitQuoteCommand[] };

  // Build QuotedCallsParams (without feeQuotes — they come from the quoteExecute below)
  const baseQuotedCallsParams: QuotedCallsParams = {
    address: quotedCallsAddress,
    quotes: quotes as SubmitQuoteCommand[],
    clientSalt,
    tokenPullMode: TokenPullMode.TransferFrom,
  };

  // Get fee estimates via quoteExecute eth_call
  const { igpQuote, tokenFeeQuote, feeQuotes } = await warpCore.getQuotedTransferFee({
    originTokenAmount,
    destination,
    sender,
    recipient,
    quotedCalls: baseQuotedCallsParams,
  });

  // Attach feeQuotes for later use in getTransferRemoteTxs (avoids re-quoting).
  const quotedCallsParams: QuotedCallsParams = { ...baseQuotedCallsParams, feeQuotes };

  // Estimate local gas for the actual QuotedCalls.execute() tx so the UI
  // pre-shows the gas cost the user will see in MetaMask. No silent fallback —
  // a throw here drops the whole offchain result (fees + quotedCallsParams),
  // so the consumer falls through to the plain transferRemote path with its
  // own matching local-gas estimate.
  const localQuote = await warpCore.getLocalTransferFeeAmount({
    originToken,
    destination,
    sender,
    interchainFee: igpQuote,
    tokenFeeQuote,
    amount: originTokenAmount.amount,
    destinationToken,
    quotedCalls: quotedCallsParams,
  });

  return {
    interchainQuote: igpQuote,
    localQuote,
    tokenFeeQuote,
    quotedCallsParams,
    issuedAt: Date.now(),
  };
}
