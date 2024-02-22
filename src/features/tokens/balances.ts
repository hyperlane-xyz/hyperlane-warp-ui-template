import { useQuery } from '@tanstack/react-query';

import { Token } from '@hyperlane-xyz/sdk';
import { isValidAddress } from '@hyperlane-xyz/utils';

import { useToastError } from '../../components/toast/useToastError';
import { getMultiProvider } from '../../context/context';
import { TransferFormValues } from '../transfer/types';
import { useAccountAddressForChain } from '../wallet/hooks/multiProtocol';

export function useBalance(chain?: ChainName, token?: Token, address?: Address) {
  const { isLoading, isError, error, data } = useQuery({
    queryKey: ['useBalance', chain, address, token?.addressOrDenom],
    queryFn: () => {
      if (!chain || !token || !address || !isValidAddress(address, token.protocol)) return null;

      return token.getBalance(getMultiProvider(), address);
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

export function useOriginBalance({ origin, token }: TransferFormValues) {
  const address = useAccountAddressForChain(origin);
  return useBalance(origin, token, address);
}

export function useDestinationBalance({
  origin,
  destination,
  token,
  recipient,
}: TransferFormValues) {
  const destinationToken = token?.getConnectedTokenForChain(destination);
  return useBalance(origin, destinationToken, recipient);
}
