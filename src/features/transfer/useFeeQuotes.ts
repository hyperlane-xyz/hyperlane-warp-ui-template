import { useQuery } from '@tanstack/react-query';

import { TokenAmount } from '@hyperlane-xyz/sdk';
import { HexString } from '@hyperlane-xyz/utils';

import { getTokenByIndex, getWarpCore } from '../../context/context';
import { logger } from '../../utils/logger';
import { getAccountAddressAndPubKey, useAccounts } from '../wallet/hooks/multiProtocol';

import { TransferFormValues } from './types';

const FEE_QUOTE_REFRESH_INTERVAL = 15_000; // 10s

export function useFeeQuotes(
  { origin, destination, tokenIndex }: TransferFormValues,
  enabled: boolean,
) {
  const { accounts } = useAccounts();
  const { address: sender, publicKey: senderPubKey } = getAccountAddressAndPubKey(origin, accounts);

  const { isLoading, isError, data } = useQuery({
    queryKey: ['useFeeQuotes', destination, tokenIndex, sender],
    queryFn: () => fetchFeeQuotes(destination, tokenIndex, sender, senderPubKey),
    enabled,
    refetchInterval: FEE_QUOTE_REFRESH_INTERVAL,
  });

  return { isLoading, isError, fees: data };
}

async function fetchFeeQuotes(
  destination?: ChainName,
  tokenIndex?: number,
  sender?: Address,
  senderPubKey?: Promise<HexString>,
): Promise<{ interchainQuote: TokenAmount; localQuote: TokenAmount } | null> {
  const originToken = getTokenByIndex(tokenIndex);
  if (!destination || !sender || !originToken) return null;
  logger.debug('Fetching fee quotes');
  return getWarpCore().estimateTransferRemoteFees({
    originToken,
    destination,
    sender,
    senderPubKey: await senderPubKey,
  });
}
