import { WarpCore, WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { HexString } from '@hyperlane-xyz/utils';
import { getAccountAddressAndPubKey, useAccounts } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { getTokenByIndex, useWarpCore } from '../tokens/hooks';
import { TransferFormValues } from './types';

const FEE_QUOTE_REFRESH_INTERVAL = 30_000; // 30s

export function useFeeQuotes(
  { origin, destination, tokenIndex }: TransferFormValues,
  enabled: boolean,
) {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const { accounts } = useAccounts(multiProvider);
  const { address: sender, publicKey: senderPubKey } = getAccountAddressAndPubKey(
    multiProvider,
    origin,
    accounts,
  );

  const isFormValid = !!(origin && destination && sender);
  const shouldFetch = enabled && isFormValid;

  const { isLoading, isError, data, isFetching } = useQuery({
    // The WarpCore class is not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['useFeeQuotes', destination, tokenIndex, sender, senderPubKey],
    queryFn: () => fetchFeeQuotes(warpCore, destination, tokenIndex, sender, senderPubKey),
    enabled: shouldFetch,
    refetchInterval: FEE_QUOTE_REFRESH_INTERVAL,
  });

  return { isLoading: isLoading || isFetching, isError, fees: data };
}

async function fetchFeeQuotes(
  warpCore: WarpCore,
  destination?: ChainName,
  tokenIndex?: number,
  sender?: Address,
  senderPubKey?: Promise<HexString>,
): Promise<WarpCoreFeeEstimate | null> {
  const originToken = getTokenByIndex(warpCore, tokenIndex);
  if (!destination || !sender || !originToken) return null;
  logger.debug('Fetching fee quotes');
  return warpCore.estimateTransferRemoteFees({
    originToken,
    destination,
    sender,
    senderPubKey: await senderPubKey,
  });
}
