import { QueryClient, useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

import { logger } from '../../utils/logger';
import { getErc20Contract } from '../contracts/erc20';
import { getProvider } from '../multiProvider';

import { isNativeToken } from './utils';

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
      return fetchTokenBalance(caip2Id, tokenAddress, accountAddress);
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

// TODO solana support here
async function fetchTokenBalance(caip2Id: Caip2Id, tokenAddress: Address, accountAddress: Address) {
  if (isNativeToken(tokenAddress)) {
    logger.debug(`Fetching balance for account ${accountAddress} native token on chain ${caip2Id}`);
    const provider = getProvider(caip2Id);
    const balance = await provider.getBalance(accountAddress);
    logger.debug(`Native token balance: ${balance.toString()}`);
    return balance.toString();
  } else {
    logger.debug(
      `Fetching balance for account ${accountAddress} token ${tokenAddress} on chain ${caip2Id}`,
    );
    const erc20 = getErc20Contract(tokenAddress, getProvider(caip2Id));
    const balance = await erc20.balanceOf(accountAddress);
    logger.debug(`Token balance: ${balance.toString()}`);
    return balance.toString();
  }
}
