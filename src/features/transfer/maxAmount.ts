import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import { TokenAmount } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { getWarpCore } from '../../context/context';
import { logger } from '../../utils/logger';
import { getChainMetadata } from '../chains/utils';
import { getAccountAddressAndPubKey } from '../wallet/hooks/multiProtocol';
import { AccountInfo } from '../wallet/hooks/types';

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
    const maxAmount = await getWarpCore().getMaxTransferAmount({
      balance,
      destination,
      sender: address,
      senderPubKey: await publicKey,
    });
    return maxAmount;
  } catch (error) {
    logger.warn('Error fetching fee quotes for max amount', error);
    const chainName = getChainMetadata(origin).displayName;
    toast.warn(`Cannot simulate transfer, ${chainName} native balance may be insufficient.`);
    return undefined;
  }
}
