import { type PredicateAttestation, IToken, Token, WarpCore, WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { HexString, toWei } from '@hyperlane-xyz/utils';
import { getAccountAddressAndPubKey, useAccounts, useDebounce } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import { defaultMultiCollateralRoutes } from '../../consts/defaultMultiCollateralRoutes';
import { getPredicateClient } from '../../lib/predicateClient';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { useWarpCore } from '../tokens/hooks';
import { getTransferToken } from './fees';
import { TransferFormValues } from './types';

const FEE_QUOTE_REFRESH_INTERVAL = 30_000; // 30s

export function useFeeQuotes(
  { originTokenKey, destinationTokenKey, amount, recipient: formRecipient }: TransferFormValues,
  enabled: boolean,
  originToken: Token | undefined,
  destinationToken: IToken | undefined,
  searchForLowestFee: boolean = false,
) {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();
  const debouncedAmount = useDebounce(amount, 500);
  const destination = destinationToken?.chainName;

  const { accounts } = useAccounts(multiProvider);
  const { address: sender, publicKey: senderPubKey } = getAccountAddressAndPubKey(
    multiProvider,
    originToken?.chainName,
    accounts,
  );

  // Get effective recipient (form value or fallback to connected wallet for destination)
  const { address: connectedDestAddress } = getAccountAddressAndPubKey(
    multiProvider,
    destinationToken?.chainName,
    accounts,
  );
  const recipient = formRecipient || connectedDestAddress || '';

  const isFormValid = !!(originToken && destination && debouncedAmount && recipient && sender);
  const shouldFetch = enabled && isFormValid;

  const { isLoading, isError, data, isFetching } = useQuery({
    // The WarpCore class is not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: [
      'useFeeQuotes',
      originTokenKey,
      destinationTokenKey,
      sender,
      senderPubKey,
      debouncedAmount,
      recipient,
    ],
    queryFn: () =>
      fetchFeeQuotes(
        warpCore,
        originToken,
        destinationToken,
        destination,
        sender,
        senderPubKey,
        debouncedAmount,
        recipient,
        searchForLowestFee,
      ),
    enabled: shouldFetch,
    refetchInterval: FEE_QUOTE_REFRESH_INTERVAL,
  });

  return { isLoading: isLoading || isFetching, isError, fees: data };
}

async function fetchFeeQuotes(
  warpCore: WarpCore,
  originToken: Token | undefined,
  destinationToken: IToken | undefined,
  destination?: ChainName,
  sender?: Address,
  senderPubKey?: Promise<HexString>,
  amount?: string,
  recipient?: string,
  searchForLowestFee: boolean = false,
): Promise<WarpCoreFeeEstimate | null> {
  if (!originToken || !destinationToken || !destination || !sender || !amount || !recipient)
    return null;

  let transferToken = originToken;
  const amountWei = toWei(amount, transferToken.decimals);

  // when true attempt to get route with lowest fee (or use default if configured)
  if (searchForLowestFee) {
    transferToken = await getTransferToken(
      warpCore,
      originToken,
      destinationToken,
      amountWei,
      recipient,
      sender,
      defaultMultiCollateralRoutes,
    );
  }

  const originTokenAmount = transferToken.amount(amountWei);

  // Check if predicate attestation needed for fee estimation
  let attestation: PredicateAttestation | undefined;
  const predicateClient = getPredicateClient();

  try {
    const needsAttestation = await warpCore.isPredicateSupported(transferToken, destination);

    if (needsAttestation) {
      // Get wrapper address for attestation request
      const adapter = transferToken.getAdapter(warpCore.multiProvider) as any;
      const wrapperAddress = await adapter.getPredicateWrapperAddress();

      // Build temp tx to get calldata for attestation
      const tempTxs = await warpCore.getTransferRemoteTxs({
        originTokenAmount,
        destination,
        sender,
        recipient,
        senderPubKey: await senderPubKey,
      });
      const tempTx = tempTxs[0] as any;

      const attestationRequest = {
        to: wrapperAddress!,
        from: sender,
        data: tempTx.transaction.data?.toString() || '0x',
        msg_value: tempTx.transaction.value?.toString() || '0',
        chain: originToken.chainName,
      };

      const response = await predicateClient.fetchAttestation(attestationRequest);
      attestation = response.attestation;
    }
  } catch (error: any) {
    logger.warn('Failed to fetch attestation for fee estimation, continuing without it:', error);
    // Continue without attestation - fee estimation will proceed
  }

  logger.debug('Fetching fee quotes');
  return warpCore.estimateTransferRemoteFees({
    originTokenAmount,
    destination,
    sender,
    senderPubKey: await senderPubKey,
    recipient: recipient,
    attestation,
  });
}
