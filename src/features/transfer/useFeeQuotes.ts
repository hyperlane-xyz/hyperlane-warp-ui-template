<<<<<<< HEAD
import { Token, WarpCore, WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
=======
import { IToken, Token, WarpCore, WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
>>>>>>> origin/main
import { HexString, toWei } from '@hyperlane-xyz/utils';
import { getAccountAddressAndPubKey, useAccounts, useDebounce } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import { defaultMultiCollateralRoutes } from '../../consts/defaultMultiCollateralRoutes';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { useWarpCore } from '../tokens/hooks';
<<<<<<< HEAD
import { getLowestFeeTransferToken } from './fees';
=======
import { getTransferToken } from './fees';
>>>>>>> origin/main
import { TransferFormValues } from './types';

const FEE_QUOTE_REFRESH_INTERVAL = 30_000; // 30s

export function useFeeQuotes(
<<<<<<< HEAD
  { destination, amount, recipient, tokenIndex }: TransferFormValues,
  enabled: boolean,
  originToken: Token | undefined,
=======
  { originTokenKey, destinationTokenKey, amount, recipient: formRecipient }: TransferFormValues,
  enabled: boolean,
  originToken: Token | undefined,
  destinationToken: IToken | undefined,
>>>>>>> origin/main
  searchForLowestFee: boolean = false,
) {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();
  const debouncedAmount = useDebounce(amount, 500);
<<<<<<< HEAD
=======
  const destination = destinationToken?.chainName;
>>>>>>> origin/main

  const { accounts } = useAccounts(multiProvider);
  const { address: sender, publicKey: senderPubKey } = getAccountAddressAndPubKey(
    multiProvider,
    originToken?.chainName,
    accounts,
  );

<<<<<<< HEAD
=======
  // Get effective recipient (form value or fallback to connected wallet for destination)
  const { address: connectedDestAddress } = getAccountAddressAndPubKey(
    multiProvider,
    destinationToken?.chainName,
    accounts,
  );
  const recipient = formRecipient || connectedDestAddress || '';

>>>>>>> origin/main
  const isFormValid = !!(originToken && destination && debouncedAmount && recipient && sender);
  const shouldFetch = enabled && isFormValid;

  const { isLoading, isError, data, isFetching } = useQuery({
    // The WarpCore class is not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: [
      'useFeeQuotes',
<<<<<<< HEAD
      tokenIndex,
      destination,
=======
      originTokenKey,
      destinationTokenKey,
>>>>>>> origin/main
      sender,
      senderPubKey,
      debouncedAmount,
      recipient,
    ],
    queryFn: () =>
      fetchFeeQuotes(
        warpCore,
        originToken,
<<<<<<< HEAD
=======
        destinationToken,
>>>>>>> origin/main
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
<<<<<<< HEAD
=======
  destinationToken: IToken | undefined,
>>>>>>> origin/main
  destination?: ChainName,
  sender?: Address,
  senderPubKey?: Promise<HexString>,
  amount?: string,
  recipient?: string,
  searchForLowestFee: boolean = false,
): Promise<WarpCoreFeeEstimate | null> {
<<<<<<< HEAD
  if (!originToken || !destination || !sender || !originToken || !amount || !recipient) return null;
  let transferToken = originToken;
  const amountWei = toWei(amount, transferToken.decimals);

  // when true attempt to get route with lowest fee
  if (searchForLowestFee) {
    const destinationToken = originToken.getConnectionForChain(destination)?.token;
    if (destinationToken) {
      transferToken = await getLowestFeeTransferToken(
        warpCore,
        originToken,
        destinationToken,
        amountWei,
        recipient,
        sender,
      );
    }
=======
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
>>>>>>> origin/main
  }

  const originTokenAmount = transferToken.amount(amountWei);
  logger.debug('Fetching fee quotes');
  return warpCore.estimateTransferRemoteFees({
    originTokenAmount,
    destination,
    sender,
    senderPubKey: await senderPubKey,
    recipient: recipient,
  });
}
