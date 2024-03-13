import { useMutation } from '@tanstack/react-query';

import { TokenAmount } from '@hyperlane-xyz/sdk';
import { ProtocolType, timeout } from '@hyperlane-xyz/utils';

import { getWarpCore } from '../../context/context';
import { logger } from '../../utils/logger';
import { getAccountAddressAndPubKey } from '../wallet/hooks/multiProtocol';
import { AccountInfo } from '../wallet/hooks/types';

const MAX_FETCH_TIMEOUT = 3000; // 3 seconds

interface FetchMaxParams {
  accounts: Record<ProtocolType, AccountInfo>;
  balance: TokenAmount;
  origin: ChainName;
  destination: ChainName;
}

export function useFetchMaxAmount() {
  const mutation = useMutation({
    mutationFn: (params: FetchMaxParams) => fetchMaxAmount(params),
  });
  return { fetchMaxAmount: mutation.mutateAsync, isLoading: mutation.isLoading };
}

async function fetchMaxAmount({ accounts, balance, destination, origin }: FetchMaxParams) {
  try {
    const { address, publicKey } = getAccountAddressAndPubKey(origin, accounts);
    if (!address) return balance;
    const maxAmount = await timeout(
      getWarpCore().getMaxTransferAmount({
        balance,
        destination,
        sender: address,
        senderPubKey: await publicKey,
      }),
      MAX_FETCH_TIMEOUT,
    );
    return maxAmount;
  } catch (error) {
    logger.warn('Error or timeout fetching fee quotes for max amount', error);
    return balance;
  }
}
