import { Hyperlane7683__factory as Hyperlane7683Factory } from '@bootnodedev/intents-framework-core';
import { IToken, MultiProtocolProvider, Token } from '@hyperlane-xyz/sdk';
import { assert, isValidAddress } from '@hyperlane-xyz/utils';
import { useAccountAddressForChain } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Hex } from 'viem';
import { useBalance as useWagmiBalance } from 'wagmi';
import { useToastError } from '../../components/toast/useToastError';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { TransferFormValues } from '../transfer/types';
import { useTokenByIndex } from './hooks';

export function useBalance(chain?: ChainName, token?: IToken, address?: Address) {
  const multiProvider = useMultiProvider();
  const { isLoading, isError, error, data } = useQuery({
    // The Token and Multiprovider classes are not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['useBalance', chain, address, token?.addressOrDenom],
    queryFn: () => {
      if (!chain || !token || !address || !isValidAddress(address, token.protocol)) return null;
      return token.getBalance(multiProvider, address);
    },
    refetchInterval: 5000,
  });

  useToastError(error, 'Error fetching balance');

  return {
    isLoading,
    isError,
    balance: data ?? undefined,
  };
}

export function useOriginBalance({ origin, tokenIndex }: TransferFormValues) {
  const multiProvider = useMultiProvider();
  const address = useAccountAddressForChain(multiProvider, origin);
  const token = useTokenByIndex(tokenIndex);
  return useBalance(origin, token, address);
}

export function useDestinationBalance({ destination, tokenIndex, recipient }: TransferFormValues) {
  const originToken = useTokenByIndex(tokenIndex);
  const connection = originToken?.getConnectionForChain(destination);
  return useBalance(destination, connection?.token, recipient);
}

export async function getDestinationNativeBalance(
  multiProvider: MultiProtocolProvider,
  { destination, recipient }: TransferFormValues,
) {
  try {
    const chainMetadata = multiProvider.getChainMetadata(destination);
    const token = Token.FromChainMetadataNativeToken(chainMetadata);
    const balance = await token.getBalance(multiProvider, recipient);
    return balance.amount;
  } catch (error) {
    const msg = `Error checking recipient balance on ${getChainDisplayName(multiProvider, destination)}`;
    logger.error(msg, error);
    toast.error(msg);
    return undefined;
  }
}

export function useEvmWalletBalance(
  chainName: string,
  chainId: number,
  token: string,
  refetchEnabled: boolean,
) {
  const multiProvider = useMultiProvider();
  const address = useAccountAddressForChain(multiProvider, chainName);
  const allowRefetch = Boolean(address) && refetchEnabled;

  const { data, isError, isLoading } = useWagmiBalance({
    address: address ? (address as Hex) : undefined,
    token: token ? (token as Hex) : undefined,
    chainId: chainId,
    query: {
      refetchInterval: allowRefetch ? 5000 : false,
      enabled: allowRefetch,
    },
  });

  return { balance: data, isError, isLoading };
}
export async function checkOrderFilled({
  destination,
  orderId,
  originToken,
  multiProvider,
}: {
  destination: ChainName;
  orderId: string;
  originToken: Token;
  multiProvider: MultiProtocolProvider;
}): Promise<string> {
  const provider = multiProvider.toMultiProvider().getProvider(destination);
  const connection = originToken.getConnectionForChain(destination);

  assert(connection?.token.addressOrDenom, 'No connection found for destination chain');

  const contract = Hyperlane7683Factory.connect(connection.token.addressOrDenom, provider);
  const filter = contract.filters.Filled();

  const BLOCKS_TO_CHECK = 10;
  const BLOCK_CHECK_INTERVAL = 4_000;

  return new Promise((resolve, reject) => {
    const intervalId = setInterval(async () => {
      try {
        const to = await provider.getBlockNumber();
        const from = to - BLOCKS_TO_CHECK;
        const events = await contract.queryFilter(filter, from, to);

        for (const event of events) {
          const resolvedOrder = event.args.orderId;

          if (resolvedOrder === orderId) {
            clearInterval(intervalId);
            resolve(event.transactionHash);
          }
        }
      } catch (error) {
        clearInterval(intervalId);
        reject(error);
      }
    }, BLOCK_CHECK_INTERVAL);
  });
}
