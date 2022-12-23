import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

import { fromWeiRounded } from '../../utils/amount';
import { logger } from '../../utils/logger';
import { getErc20Contract } from '../contracts/erc20';
import { getProvider } from '../providers';

export function useTokenBalance(chainId: number, tokenAddress: Address) {
  const { address: accountAddress, isConnected } = useAccount();

  const {
    isLoading: isFetching,
    isError: hasError,
    data: balance,
  } = useQuery(
    ['tokenBalance', chainId, tokenAddress, accountAddress, isConnected],
    () => {
      console.log(chainId, tokenAddress, accountAddress, isConnected);
      if (!chainId || !tokenAddress || !accountAddress || !isConnected) return null;
      return fetchTokenBalance(chainId, tokenAddress, accountAddress);
    },
    { retry: false },
  );

  return { isFetching, hasError, balance };
}

async function fetchTokenBalance(chainId: number, tokenAddress: Address, accountAddress: Address) {
  logger.debug(
    `Fetching balance for account ${accountAddress} token ${tokenAddress} on chain ${chainId}`,
  );
  const erc20 = getErc20Contract(tokenAddress, getProvider(chainId));
  const balance = await erc20.balanceOf(accountAddress);
  return balance.toString();
}

export function TokenBalance({
  chainId,
  tokenAddress,
}: {
  chainId: number;
  tokenAddress: Address;
}) {
  console.log('in token balance');
  console.log(chainId, tokenAddress);
  const { balance } = useTokenBalance(chainId, tokenAddress);
  return (
    <div
      className={`text-xs text-gray-500 ${!balance && 'opacity-0'} transition-all duration-300`}
    >{`Balance: ${fromWeiRounded(balance)}`}</div>
  );
}
