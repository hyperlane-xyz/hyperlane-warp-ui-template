import { QueryClient, useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

import { logger } from '../../utils/logger';
import { getErc20Contract } from '../contracts/erc20';
import { getProvider } from '../multiProvider';

import { isNativeToken } from './utils';

export function getTokenBalanceKey(
  chainId: ChainId,
  tokenAddress: Address,
  accountAddress?: Address,
) {
  return ['tokenBalance', chainId, tokenAddress, accountAddress];
}

export function useAccountTokenBalance(chainId: ChainId, tokenAddress: Address) {
  const { address: accountAddress } = useAccount();
  return useTokenBalance(chainId, tokenAddress, accountAddress);
}

export function useTokenBalance(chainId: ChainId, tokenAddress: Address, accountAddress?: Address) {
  const {
    isLoading,
    isError: hasError,
    data: balance,
  } = useQuery({
    queryKey: getTokenBalanceKey(chainId, tokenAddress, accountAddress),
    queryFn: () => {
      if (!chainId || !tokenAddress || !accountAddress) return null;
      return fetchTokenBalance(chainId, tokenAddress, accountAddress);
    },
    refetchInterval: 7500,
  });

  return { isLoading, hasError, balance };
}

export function getCachedTokenBalance(
  queryClient: QueryClient,
  chainId: ChainId,
  tokenAddress: Address,
  accountAddress?: Address,
) {
  return queryClient.getQueryData(getTokenBalanceKey(chainId, tokenAddress, accountAddress)) as
    | string
    | undefined;
}

async function fetchTokenBalance(chainId: ChainId, tokenAddress: Address, accountAddress: Address) {
  if (isNativeToken(tokenAddress)) {
    logger.debug(`Fetching balance for account ${accountAddress} native token on chain ${chainId}`);
    const provider = getProvider(chainId);
    const balance = await provider.getBalance(accountAddress);
    logger.debug(`Native token balance: ${balance.toString()}`);
    return balance.toString();
  } else {
    logger.debug(
      `Fetching balance for account ${accountAddress} token ${tokenAddress} on chain ${chainId}`,
    );
    const erc20 = getErc20Contract(tokenAddress, getProvider(chainId));
    const balance = await erc20.balanceOf(accountAddress);
    logger.debug(`Token balance: ${balance.toString()}`);
    return balance.toString();
  }
}
