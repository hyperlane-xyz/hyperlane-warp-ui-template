import { useQuery } from '@tanstack/react-query';

import { TokenAmount } from '@hyperlane-xyz/sdk';

import { useToastError } from '../../components/toast/useToastError';
import { getTokenByIndex, getWarpCore } from '../../context/context';
import { logger } from '../../utils/logger';
import { useAccountAddressForChain } from '../wallet/hooks/multiProtocol';

import { TransferFormValues } from './types';

const FEE_QUOTE_REFRESH_INTERVAL = 10_000; // 10s

export function useFeeQuotes(
  { origin, destination, tokenIndex }: Partial<TransferFormValues>,
  enabled: boolean,
) {
  const sender = useAccountAddressForChain(origin);
  const { isLoading, isError, error, data } = useQuery({
    queryKey: ['useFeeQuotes', destination, tokenIndex, sender],
    queryFn: () => fetchFeeQuotes(destination, tokenIndex, sender),
    enabled,
    refetchInterval: FEE_QUOTE_REFRESH_INTERVAL,
  });

  useToastError(error, 'Error fetching fee quotes');

  return { isLoading, isError, fees: data };
}

export async function fetchFeeQuotes(
  destination?: ChainName,
  tokenIndex?: number,
  sender?: Address,
): Promise<{ interchainQuote: TokenAmount; localQuote: TokenAmount } | null> {
  const originToken = getTokenByIndex(tokenIndex);
  if (!destination || !sender || !originToken) return null;
  logger.debug('Fetching fee quotes');
  return getWarpCore().estimateTransferRemoteFees(originToken, destination, sender);
}
