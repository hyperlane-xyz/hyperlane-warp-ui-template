import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { areAddressesEqual, isValidAddress } from '../../utils/addresses';
import { logger } from '../../utils/logger';
import { getProtocolType } from '../caip/chains';
import { parseCaip19Id, tryGetCaip2FromToken } from '../caip/tokens';
import { getProvider } from '../multiProvider';
import { useStore } from '../store';
import { TransferFormValues } from '../transfer/types';
import { useAccountForChain } from '../wallet/hooks';

import { AdapterFactory } from './adapters/AdapterFactory';
import { getHypErc721Contract } from './contracts/evmContracts';
import { RoutesMap } from './routes/types';
import { getTokenRoute } from './routes/utils';

export function useOriginBalance(
  { originCaip2Id, destinationCaip2Id, tokenCaip19Id }: TransferFormValues,
  tokenRoutes: RoutesMap,
) {
  const address = useAccountForChain(originCaip2Id)?.address;
  const setSenderBalance = useStore((state) => state.setSenderBalance);

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
      const adapter = AdapterFactory.HypTokenAdapterFromRouteOrigin(route);
      const balance = await adapter.getBalance(address);
      return { balance, decimals: route.decimals };
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    setSenderBalance(data?.balance || '0');
  }, [data?.balance, setSenderBalance]);

  return { isLoading, hasError, balance: data?.balance, decimals: data?.decimals };
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
      return { balance, decimals: route.decimals };
    },
    refetchInterval: 5000,
  });

  return { isLoading, hasError, balance: data?.balance, decimals: data?.decimals };
}

// TODO solana support
export function useOriginTokenIdBalance(caip19Id: Caip19Id) {
  const caip2Id = tryGetCaip2FromToken(caip19Id);
  const accountAddress = useAccountForChain(caip2Id)?.address;
  const setSenderNftIds = useStore((state) => state.setSenderNftIds);

  const {
    isLoading,
    isError: hasError,
    data: tokenIds,
  } = useQuery({
    queryKey: ['useOriginTokenIdBalance', caip19Id, accountAddress],
    queryFn: () => {
      if (!caip19Id || !accountAddress) return null;
      return fetchListOfERC721TokenId(caip19Id, accountAddress);
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
  caip19Id: Caip19Id,
  accountAddress: Address,
): Promise<string[]> {
  const { caip2Id, address: tokenAddress } = parseCaip19Id(caip19Id);
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

// TODO solana support
export function useContractSupportsTokenByOwner(caip19Id: Caip19Id, accountAddress?: Address) {
  const {
    isLoading,
    isError: hasError,
    data: isContractAllowToGetTokenIds,
  } = useQuery({
    queryKey: ['useContractSupportsTokenByOwner', caip19Id, accountAddress],
    queryFn: () => {
      if (!caip19Id || !accountAddress) return null;
      return contractSupportsTokenByOwner(caip19Id, accountAddress);
    },
  });

  return { isLoading, hasError, isContractAllowToGetTokenIds };
}

// TODO solana support
async function contractSupportsTokenByOwner(
  caip19Id: Caip19Id,
  accountAddress: Address,
): Promise<boolean> {
  const { caip2Id, address: tokenAddress } = parseCaip19Id(caip19Id);
  const hypERC721 = getHypErc721Contract(tokenAddress, getProvider(caip2Id));
  try {
    await hypERC721.tokenOfOwnerByIndex(accountAddress, '0');
    return true;
  } catch (error) {
    return false;
  }
}

// TODO solana support
export function useIsSenderNftOwner(caip19Id: Caip19Id, tokenId: string) {
  const caip2Id = tryGetCaip2FromToken(caip19Id);
  const senderAddress = useAccountForChain(caip2Id)?.address;
  const setIsSenderNftOwner = useStore((state) => state.setIsSenderNftOwner);

  const {
    isLoading,
    isError: hasError,
    data: owner,
  } = useQuery({
    queryKey: ['useOwnerOfErc721', caip19Id, tokenId],
    queryFn: () => {
      if (!caip19Id || !tokenId) return null;
      return fetchERC721Owner(caip19Id, tokenId);
    },
  });

  useEffect(() => {
    if (!senderAddress || !owner) setIsSenderNftOwner(null);
    else setIsSenderNftOwner(areAddressesEqual(senderAddress, owner));
  }, [owner, senderAddress, setIsSenderNftOwner]);

  return { isLoading, hasError, owner };
}

// TODO solana support
async function fetchERC721Owner(caip19Id: Caip19Id, tokenId: string): Promise<string> {
  const { caip2Id, address: tokenAddress } = parseCaip19Id(caip19Id);
  const hypERC721 = getHypErc721Contract(tokenAddress, getProvider(caip2Id));
  try {
    const ownerAddress = await hypERC721.ownerOf(tokenId);
    return ownerAddress;
  } catch (error) {
    return '';
  }
}
