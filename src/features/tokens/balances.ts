import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { eqAddress, isValidAddress } from '@hyperlane-xyz/utils';

import { logger } from '../../utils/logger';
import { getProtocolType } from '../caip/chains';
import { parseCaip19Id, tryGetChainIdFromToken } from '../caip/tokens';
import { getEvmProvider } from '../multiProvider';
import { useStore } from '../store';
import { TransferFormValues } from '../transfer/types';
import { useAccountForChain } from '../wallet/hooks';

import { AdapterFactory } from './AdapterFactory';
import { getHypErc721Contract } from './contracts/evmContracts';
import { RoutesMap } from './routes/types';
import { getTokenRoute, isRouteFromNative } from './routes/utils';

export function useOriginBalance(
  { originCaip2Id, destinationCaip2Id, tokenCaip19Id }: TransferFormValues,
  tokenRoutes: RoutesMap,
) {
  const address = useAccountForChain(originCaip2Id)?.address;
  const setSenderBalances = useStore((state) => state.setSenderBalances);

  const {
    isLoading,
    isError: hasError,
    data,
  } = useQuery({
    queryKey: [
      'useOriginBalance',
      address,
      originCaip2Id,
      destinationCaip2Id,
      tokenCaip19Id,
      tokenRoutes,
    ],
    queryFn: async () => {
      const route = getTokenRoute(originCaip2Id, destinationCaip2Id, tokenCaip19Id, tokenRoutes);
      const protocol = getProtocolType(originCaip2Id);
      if (!route || !address || !isValidAddress(address, protocol)) return null;
      const tokenAdapter = AdapterFactory.HypTokenAdapterFromRouteOrigin(route);
      const tokenBalance = await tokenAdapter.getBalance(address);

      let nativeBalance;
      if (isRouteFromNative(route)) {
        nativeBalance = tokenBalance;
      } else {
        const nativeAdapter = AdapterFactory.NativeAdapterFromChain(originCaip2Id);
        nativeBalance = await nativeAdapter.getBalance(address);
      }

      return { tokenBalance, tokenDecimals: route.originDecimals, nativeBalance };
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    setSenderBalances(data?.tokenBalance || '0', data?.nativeBalance || '0');
  }, [data, setSenderBalances]);

  return {
    isLoading,
    hasError,
    tokenBalance: data?.tokenBalance,
    tokenDecimals: data?.tokenDecimals,
    nativeBalance: data?.nativeBalance,
  };
}

export function useDestinationBalance(
  { originCaip2Id, destinationCaip2Id, tokenCaip19Id, recipientAddress }: TransferFormValues,
  tokenRoutes: RoutesMap,
) {
  const {
    isLoading,
    isError: hasError,
    data,
  } = useQuery({
    queryKey: [
      'useDestinationBalance',
      recipientAddress,
      originCaip2Id,
      destinationCaip2Id,
      tokenCaip19Id,
      tokenRoutes,
    ],
    queryFn: async () => {
      const route = getTokenRoute(originCaip2Id, destinationCaip2Id, tokenCaip19Id, tokenRoutes);
      const protocol = getProtocolType(destinationCaip2Id);
      if (!route || !recipientAddress || !isValidAddress(recipientAddress, protocol)) return null;
      const adapter = AdapterFactory.HypTokenAdapterFromRouteDest(route);
      const balance = await adapter.getBalance(recipientAddress);
      return { balance, decimals: route.destDecimals };
    },
    refetchInterval: 5000,
  });

  return { isLoading, hasError, balance: data?.balance, decimals: data?.decimals };
}

// TODO solana support
export function useOriginTokenIdBalance(tokenCaip19Id: TokenCaip19Id) {
  const chainCaip2Id = tryGetChainIdFromToken(tokenCaip19Id);
  const accountAddress = useAccountForChain(chainCaip2Id)?.address;
  const setSenderNftIds = useStore((state) => state.setSenderNftIds);

  const {
    isLoading,
    isError: hasError,
    data: tokenIds,
  } = useQuery({
    queryKey: ['useOriginTokenIdBalance', tokenCaip19Id, accountAddress],
    queryFn: () => {
      if (!tokenCaip19Id || !accountAddress) return null;
      return fetchListOfERC721TokenId(tokenCaip19Id, accountAddress);
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    setSenderNftIds(tokenIds && Array.isArray(tokenIds) ? tokenIds : null);
  }, [tokenIds, setSenderNftIds]);

  return { isLoading, hasError, tokenIds };
}

// TODO solana support
export async function fetchListOfERC721TokenId(
  tokenCaip19Id: TokenCaip19Id,
  accountAddress: Address,
): Promise<string[]> {
  const { chainCaip2Id, address: tokenAddress } = parseCaip19Id(tokenCaip19Id);
  logger.debug(`Fetching list of tokenID for account ${accountAddress} on chain ${chainCaip2Id}`);

  const hypERC721 = getHypErc721Contract(tokenAddress, getEvmProvider(chainCaip2Id));

  const balance = await hypERC721.balanceOf(accountAddress);
  const index = Array.from({ length: parseInt(balance.toString()) }, (_, index) => index);
  const promises: Promise<string>[] = index.map(async (id) => {
    const response = await hypERC721.tokenOfOwnerByIndex(accountAddress, id);

    return response.toString();
  });
  const result = await Promise.all(promises);
  logger.debug(`TokenIds that the ${accountAddress} owns on chain ${chainCaip2Id}: ${result} `);
  return result;
}

// TODO solana support
export function useContractSupportsTokenByOwner(
  tokenCaip19Id: TokenCaip19Id,
  accountAddress?: Address,
) {
  const {
    isLoading,
    isError: hasError,
    data: isContractAllowToGetTokenIds,
  } = useQuery({
    queryKey: ['useContractSupportsTokenByOwner', tokenCaip19Id, accountAddress],
    queryFn: () => {
      if (!tokenCaip19Id || !accountAddress) return null;
      return contractSupportsTokenByOwner(tokenCaip19Id, accountAddress);
    },
  });

  return { isLoading, hasError, isContractAllowToGetTokenIds };
}

// TODO solana support
async function contractSupportsTokenByOwner(
  tokenCaip19Id: TokenCaip19Id,
  accountAddress: Address,
): Promise<boolean> {
  const { chainCaip2Id, address: tokenAddress } = parseCaip19Id(tokenCaip19Id);
  const hypERC721 = getHypErc721Contract(tokenAddress, getEvmProvider(chainCaip2Id));
  try {
    await hypERC721.tokenOfOwnerByIndex(accountAddress, '0');
    return true;
  } catch (error) {
    return false;
  }
}

// TODO solana support
export function useIsSenderNftOwner(tokenCaip19Id: TokenCaip19Id, tokenId: string) {
  const chainCaip2Id = tryGetChainIdFromToken(tokenCaip19Id);
  const senderAddress = useAccountForChain(chainCaip2Id)?.address;
  const setIsSenderNftOwner = useStore((state) => state.setIsSenderNftOwner);

  const {
    isLoading,
    isError: hasError,
    data: owner,
  } = useQuery({
    queryKey: ['useOwnerOfErc721', tokenCaip19Id, tokenId],
    queryFn: () => {
      if (!tokenCaip19Id || !tokenId) return null;
      return fetchERC721Owner(tokenCaip19Id, tokenId);
    },
  });

  useEffect(() => {
    if (!senderAddress || !owner) setIsSenderNftOwner(null);
    else setIsSenderNftOwner(eqAddress(senderAddress, owner));
  }, [owner, senderAddress, setIsSenderNftOwner]);

  return { isLoading, hasError, owner };
}

// TODO solana support
async function fetchERC721Owner(tokenCaip19Id: TokenCaip19Id, tokenId: string): Promise<string> {
  const { chainCaip2Id, address: tokenAddress } = parseCaip19Id(tokenCaip19Id);
  const hypERC721 = getHypErc721Contract(tokenAddress, getEvmProvider(chainCaip2Id));
  try {
    const ownerAddress = await hypERC721.ownerOf(tokenId);
    return ownerAddress;
  } catch (error) {
    return '';
  }
}
