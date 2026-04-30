import {
  IToken,
  QuotedCallsParams,
  SubmitQuoteCommand,
  Token,
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

interface QuotedCallsFeeResult {
  interchainQuote: import('@hyperlane-xyz/sdk').TokenAmount;
  localQuote: import('@hyperlane-xyz/sdk').TokenAmount;
  tokenFeeQuote?: import('@hyperlane-xyz/sdk').TokenAmount;
  quotedCallsParams: QuotedCallsParams;
}

export function useQuotedCallsFeeQuotes(
  { originTokenKey, destinationTokenKey, amount, recipient: formRecipient }: TransferFormValues,
  enabled: boolean,
  originToken: Token | undefined,
  destinationToken: IToken | undefined,
) {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();
  const registry = useStore((s) => s.registry);
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

  const isEvm = originToken?.protocol === ProtocolType.Ethereum;
  const isFormValid = !!(originToken && destination && debouncedAmount && recipient && sender);
  const shouldFetch = enabled && isFormValid && isEvm && !!config.feeQuotingUrl;

  const { isLoading, isError, data, isFetching } = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: [
      'useQuotedCallsFeeQuotes',
      originTokenKey,
      destinationTokenKey,
      sender,
      debouncedAmount,
      recipient,
    ],
    queryFn: () =>
      fetchQuotedCallsFees(
        warpCore,
        registry,
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

  return {
    isLoading: isLoading || isFetching,
    isError,
    fees: data
      ? {
          interchainQuote: data.interchainQuote,
          localQuote: data.localQuote,
          tokenFeeQuote: data.tokenFeeQuote,
        }
      : null,
    quotedCallsParams: data?.quotedCallsParams ?? null,
  };
}

function generateClientSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function fetchQuotedCallsFees(
  warpCore: WarpCore,
  registry: import('@hyperlane-xyz/registry').IRegistry,
  originToken: Token | undefined,
  destinationToken: IToken | undefined,
  destination: string | undefined,
  sender: string | undefined,
  amount: string | undefined,
  recipient: string | undefined,
): Promise<QuotedCallsFeeResult | null> {
  if (!originToken || !destinationToken || !destination || !sender || !amount || !recipient)
    return null;

  // Look up quotedCalls address from registry
  const addresses = await registry.getAddresses();
  const chainAddresses = addresses[originToken.chainName];
  const quotedCallsAddress = chainAddresses?.quotedCalls as Address | undefined;
  if (!quotedCallsAddress) {
    logger.debug('No quotedCalls address found for chain', originToken.chainName);
    return null;
  }

  const amountWei = toWei(amount, originToken.decimals);
  const originTokenAmount = originToken.amount(amountWei);

  // Generate salt
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

  // Build QuotedCallsParams
  const quotedCallsParams: QuotedCallsParams = {
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
    quotedCalls: quotedCallsParams,
  });

  // Attach feeQuotes to params for later use in getTransferRemoteTxs
  quotedCallsParams.feeQuotes = feeQuotes;

  // localQuote is zero for QuotedCalls (gas is part of the execute tx)
  const localQuote = igpQuote.token.amount(0n);

  return {
    interchainQuote: igpQuote,
    localQuote,
    tokenFeeQuote,
    quotedCallsParams,
  };
}
