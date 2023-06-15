import { QueryClient, useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';

import { logger } from '../../utils/logger';
import { getProvider } from '../multiProvider';

import { AdapterFactory } from './adapters/AdapterFactory';
import { getHypErc721Contract } from './contracts/evmContracts';

export function getTokenBalanceKey(
  caip2Id: Caip2Id,
  tokenAddress: Address,
  accountAddress?: Address,
) {
  return ['tokenBalance', caip2Id, tokenAddress, accountAddress];
}

export function useAccountTokenBalance(caip2Id: Caip2Id, tokenAddress: Address) {
  // TODO solana support
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

export function getTokenBalanceIdKey(
  caip2Id: Caip2Id,
  tokenAddress: Address,
  accountAddress?: Address,
) {
  return ['tokenIdBalance', caip2Id, tokenAddress, accountAddress];
}

// TODO solana support
export function useTokenIdBalance(
  caip2Id: Caip2Id,
  tokenAddress: Address,
  accountAddress?: Address,
) {
  const {
    isLoading,
    isError: hasError,
    data: tokenIds,
  } = useQuery({
    queryKey: getTokenBalanceIdKey(caip2Id, tokenAddress, accountAddress),
    queryFn: () => {
      if (!caip2Id || !tokenAddress || !accountAddress) return null;
      return fetchListOfERC721TokenId(caip2Id, tokenAddress, accountAddress);
    },
    refetchInterval: 7500,
  });

  return { isLoading, hasError, tokenIds };
}

// TODO solana support
export async function fetchListOfERC721TokenId(
  caip2Id: Caip2Id,
  tokenAddress: Address,
  accountAddress: Address,
): Promise<string[]> {
  logger.debug(`Fetching list of tokenID for account ${accountAddress} on chain ${caip2Id}`);

  const hypERC721 = getHypErc721Contract(tokenAddress, getProvider(caip2Id));

  const balance = await hypERC721.balanceOf(accountAddress);
  const index = Array.from({ length: parseInt(balance.toString()) }, (_, index) => index);
  const promises: Promise<string>[] = index.map(async (id) => {
    const response = await hypERC721.tokenOfOwnerByIndex(accountAddress, id);

    return response.toString();
  });
  const result = await Promise.all(promises);
  logger.debug(`TokenIds that the ${accountAddress} owns on chain ${caip2Id}: ${result} `);
  return result;
}

export function getCachedTokenIdBalance(
  queryClient: QueryClient,
  caip2Id: Caip2Id,
  tokenAddress: Address,
  accountAddress?: Address,
) {
  return queryClient.getQueryData(getTokenBalanceIdKey(caip2Id, tokenAddress, accountAddress)) as
    | string[]
    | undefined;
}

export function getContractSupportsTokenByOwnerKey(
  caip2Id: Caip2Id,
  tokenAddress: Address,
  accountAddress?: Address,
) {
  return ['contractSupportsTokenByOwner', caip2Id, tokenAddress, accountAddress];
}

// TODO solana support
export function useContractSupportsTokenByOwner(
  caip2Id: Caip2Id,
  tokenAddress: Address,
  accountAddress?: Address,
) {
  const {
    isLoading,
    isError: hasError,
    data: isContractAllowToGetTokenIds,
  } = useQuery({
    queryKey: getContractSupportsTokenByOwnerKey(caip2Id, tokenAddress, accountAddress),
    queryFn: () => {
      if (!caip2Id || !tokenAddress || !accountAddress) return null;
      return contractSupportsTokenByOwner(caip2Id, tokenAddress, accountAddress);
    },
  });

  return { isLoading, hasError, isContractAllowToGetTokenIds };
}

// TODO solana support
export async function contractSupportsTokenByOwner(
  caip2Id: Caip2Id,
  tokenAddress: Address,
  accountAddress: Address,
): Promise<boolean> {
  const hypERC721 = getHypErc721Contract(tokenAddress, getProvider(caip2Id));
  try {
    await hypERC721.tokenOfOwnerByIndex(accountAddress, '0');
    return true;
  } catch (error) {
    return false;
  }
}

export function getOwnerOfKey(caip2Id: Caip2Id, tokenAddress: Address, tokenId: string) {
  return ['ownerOf', caip2Id, tokenAddress, tokenId];
}

// TODO solana support
export function useOwnerOfErc721(caip2Id: Caip2Id, tokenAddress: Address, tokenId: string) {
  const {
    isLoading,
    isError: hasError,
    data: owner,
  } = useQuery({
    queryKey: getOwnerOfKey(caip2Id, tokenAddress, tokenId),
    queryFn: () => {
      if (!caip2Id || !tokenAddress || !tokenId) return null;
      return fetchERC721Owner(caip2Id, tokenAddress, tokenId);
    },
  });

  return { isLoading, hasError, owner };
}

// TODO solana support
export async function fetchERC721Owner(
  caip2Id: Caip2Id,
  tokenAddress: Address,
  tokenId: string,
): Promise<string> {
  const hypERC721 = getHypErc721Contract(tokenAddress, getProvider(caip2Id));
  try {
    const ownerAddress = await hypERC721.ownerOf(tokenId);
    return ownerAddress;
  } catch (error) {
    return '';
  }
}

export function getCachedOwnerOf(
  queryClient: QueryClient,
  caip2Id: Caip2Id,
  tokenAddress: Address,
  tokenId: string,
) {
  return queryClient.getQueryData(getOwnerOfKey(caip2Id, tokenAddress, tokenId)) as
    | string
    | undefined;
}
