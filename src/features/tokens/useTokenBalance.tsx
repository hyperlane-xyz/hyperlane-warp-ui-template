import { QueryClient, useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

import { logger } from '../../utils/logger';
import { getHypErc721Contract } from '../contracts/hypToken';
import { getErc20Contract } from '../contracts/token';
import { getProvider } from '../multiProvider';

import { isNativeToken } from './utils';

export function getTokenBalanceKey(
  chainId: ChainId,
  tokenAddress: Address,
  accountAddress?: Address,
) {
  return ['tokenBalance', chainId, tokenAddress, accountAddress];
}

export function getTokenIdKey(chainId: ChainId, tokenAddress: Address, accountAddress?: Address) {
  return ['tokenId', chainId, tokenAddress, accountAddress];
}

export function contractSupportsTokenByOwnerKey(
  chainId: ChainId,
  tokenAddress: Address,
  accountAddress?: Address,
) {
  return ['contractSupportsTokenByOwner', chainId, tokenAddress, accountAddress];
}

export function getOwnerOfKey(chainId: ChainId, tokenAddress: Address, tokenId: string) {
  return ['ownerOf', chainId, tokenAddress, tokenId];
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

export function useContractSupportsTokenByOwner(
  chainId: ChainId,
  tokenAddress: Address,
  accountAddress?: Address,
) {
  const {
    isLoading,
    isError: hasError,
    data: isContractAllowToGetTokenIds,
  } = useQuery({
    queryKey: contractSupportsTokenByOwnerKey(chainId, tokenAddress, accountAddress),
    queryFn: () => {
      if (!chainId || !tokenAddress || !accountAddress) return null;
      return contractSupportsTokenByOwner(chainId, tokenAddress, accountAddress);
    },
  });

  return { isLoading, hasError, isContractAllowToGetTokenIds };
}

export function useTokenIdBalance(
  chainId: ChainId,
  tokenAddress: Address,
  accountAddress?: Address,
) {
  const {
    isLoading,
    isError: hasError,
    data: tokenIds,
  } = useQuery({
    queryKey: getTokenIdKey(chainId, tokenAddress, accountAddress),
    queryFn: () => {
      if (!chainId || !tokenAddress || !accountAddress) return null;
      return fetchListOfERC721TokenId(chainId, tokenAddress, accountAddress);
    },
    refetchInterval: 7500,
  });

  return { isLoading, hasError, tokenIds };
}

export function useOwnerOfErc721(chainId: ChainId, tokenAddress: Address, tokenId: string) {
  const {
    isLoading,
    isError: hasError,
    data: owner,
  } = useQuery({
    queryKey: getOwnerOfKey(chainId, tokenAddress, tokenId),
    queryFn: () => {
      if (!chainId || !tokenAddress || !tokenId) return null;
      return getERC721Owner(chainId, tokenAddress, tokenId);
    },
  });

  return { isLoading, hasError, owner };
}

export function getCachedOwnerOf(
  queryClient: QueryClient,
  chainId: ChainId,
  tokenAddress: Address,
  tokenId: string,
) {
  return queryClient.getQueryData(getOwnerOfKey(chainId, tokenAddress, tokenId)) as
    | string
    | undefined;
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

export async function fetchListOfERC721TokenId(
  chainId: ChainId,
  tokenAddress: Address,
  accountAddress: Address,
): Promise<string[]> {
  logger.debug(`Fetching list of tokenID for account ${accountAddress} on chain ${chainId}`);

  const hypERC721 = getHypErc721Contract(tokenAddress, getProvider(chainId));

  const balance = await hypERC721.balanceOf(accountAddress);
  const index = Array.from({ length: parseInt(balance.toString()) }, (_, index) => index);
  const promises: Promise<string>[] = index.map(async (id) => {
    const response = await hypERC721.tokenOfOwnerByIndex(accountAddress, id);

    return response.toString();
  });
  const result = await Promise.all(promises);
  logger.debug(`TokenIds that the ${accountAddress} owns on chain ${chainId}: ${result} `);
  return result;
}

export async function contractSupportsTokenByOwner(
  chainId: ChainId,
  tokenAddress: Address,
  accountAddress: Address,
): Promise<boolean> {
  const hypERC721 = getHypErc721Contract(tokenAddress, getProvider(chainId));
  try {
    await hypERC721.tokenOfOwnerByIndex(accountAddress, '0');

    return true;
  } catch (error) {
    return false;
  }
}

export async function getERC721Owner(
  chainId: ChainId,
  tokenAddress: Address,
  tokenId: string,
): Promise<string> {
  const hypERC721 = getHypErc721Contract(tokenAddress, getProvider(chainId));
  try {
    const ownerAddress = await hypERC721.ownerOf(tokenId);

    return ownerAddress;
  } catch (error) {
    return '';
  }
}
