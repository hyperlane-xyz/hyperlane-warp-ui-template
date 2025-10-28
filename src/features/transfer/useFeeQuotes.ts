import { Token, WarpCore, WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { HexString } from '@hyperlane-xyz/utils';
import { getAccountAddressAndPubKey, useAccounts } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { useWarpCore } from '../tokens/hooks';
import { getTransferToken } from './TransferTokenForm';
import { TransferFormValues } from './types';

const FEE_QUOTE_REFRESH_INTERVAL = 30_000; // 30s

export function useFeeQuotes(
  { destination, tokenIndex }: TransferFormValues,
  enabled: boolean,
  originToken: Token | undefined,
  searchForHighestCollateralToken: boolean = false,
) {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const { accounts } = useAccounts(multiProvider);
  const { address: sender, publicKey: senderPubKey } = getAccountAddressAndPubKey(
    multiProvider,
    originToken?.chainName,
    accounts,
  );

  const isFormValid = !!(originToken && destination && sender);
  const shouldFetch = enabled && isFormValid;

  const { isLoading, isError, data, isFetching } = useQuery({
    // The WarpCore class is not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['useFeeQuotes', destination, tokenIndex, sender, senderPubKey],
    queryFn: () =>
      fetchFeeQuotes(
        warpCore,
        originToken,
        destination,
        sender,
        senderPubKey,
        searchForHighestCollateralToken,
      ),
    enabled: shouldFetch,
    refetchInterval: FEE_QUOTE_REFRESH_INTERVAL,
  });

  return { isLoading: isLoading || isFetching, isError, fees: data };
}

async function fetchFeeQuotes(
  warpCore: WarpCore,
  originToken: Token | undefined,
  destination?: ChainName,
  sender?: Address,
  senderPubKey?: Promise<HexString>,
  searchForHighestCollateralToken: boolean = false,
): Promise<WarpCoreFeeEstimate | null> {
  if (!destination || !sender || !originToken) return null;
  let transferToken = originToken;

  if (searchForHighestCollateralToken) {
    const destinationToken = originToken.getConnectionForChain(destination)?.token;
    if (destinationToken) {
      transferToken = await getTransferToken(warpCore, originToken, destinationToken);
    }
  }

  logger.debug('Fetching fee quotes');
  return warpCore.estimateTransferRemoteFees({
    originToken: transferToken,
    destination,
    sender,
    senderPubKey: await senderPubKey,
  });
}
