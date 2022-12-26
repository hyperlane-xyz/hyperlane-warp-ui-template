import { QueryClient, useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

import { logger } from '../../utils/logger';
import { getErc20Contract } from '../contracts/erc20';
import { getProvider } from '../providers';

export function getTokenBalanceKey(
  chainId: number,
  tokenAddress: Address,
  isConnected: boolean,
  accountAddress?: Address,
) {
  return ['tokenBalance', chainId, tokenAddress, accountAddress, isConnected];
}

export function useTokenBalance(chainId: number, tokenAddress: Address) {
  const { address: accountAddress, isConnected } = useAccount();

  const {
    isLoading: isFetching,
    isError: hasError,
    data: balance,
  } = useQuery(
    getTokenBalanceKey(chainId, tokenAddress, isConnected, accountAddress),
    () => {
      if (!chainId || !tokenAddress || !accountAddress || !isConnected) return null;
      return fetchTokenBalance(chainId, tokenAddress, accountAddress);
    },
    { retry: false },
  );

  return { isFetching, hasError, balance };
}

export function getCachedTokenBalance(
  queryClient: QueryClient,
  chainId: number,
  tokenAddress: Address,
  isConnected: boolean,
  accountAddress?: Address,
) {
  return queryClient.getQueryData(
    getTokenBalanceKey(chainId, tokenAddress, isConnected, accountAddress),
  ) as string | undefined;
}

async function fetchTokenBalance(chainId: number, tokenAddress: Address, accountAddress: Address) {
  logger.debug(
    `Fetching balance for account ${accountAddress} token ${tokenAddress} on chain ${chainId}`,
  );
  const erc20 = getErc20Contract(tokenAddress, getProvider(chainId));
  const balance = await erc20.balanceOf(accountAddress);
  return balance.toString();
}
