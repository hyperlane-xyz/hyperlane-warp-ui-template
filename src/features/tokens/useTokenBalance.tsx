import { QueryClient, useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

import { AdapterFactory } from './adapters/AdapterFactory';

export function getTokenBalanceKey(
  caip2Id: Caip2Id,
  tokenAddress: Address,
  accountAddress?: Address,
) {
  return ['tokenBalance', caip2Id, tokenAddress, accountAddress];
}

export function useAccountTokenBalance(caip2Id: Caip2Id, tokenAddress: Address) {
  const { address: accountAddress } = useAccount();
  return useTokenBalance(caip2Id, tokenAddress, accountAddress);
}

export function useTokenBalance(caip2Id: Caip2Id, tokenAddress: Address, accountAddress?: Address) {
  const {
    isLoading,
    isError: hasError,
    data: balance,
  } = useQuery({
    queryKey: getTokenBalanceKey(caip2Id, tokenAddress, accountAddress),
    queryFn: () => {
      if (!caip2Id || !tokenAddress || !accountAddress) return null;
      const adapter = AdapterFactory.TokenAdapterFromAddress(caip2Id, tokenAddress);
      return adapter.getBalance(accountAddress);
    },
    refetchInterval: 7500,
  });

  return { isLoading, hasError, balance };
}

export function getCachedTokenBalance(
  queryClient: QueryClient,
  caip2Id: Caip2Id,
  tokenAddress: Address,
  accountAddress?: Address,
) {
  return queryClient.getQueryData(getTokenBalanceKey(caip2Id, tokenAddress, accountAddress)) as
    | string
    | undefined;
}
