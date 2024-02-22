import { useQuery } from '@tanstack/react-query';

import { isValidAddress } from '@hyperlane-xyz/utils';

import { useToastError } from '../../components/toast/useToastError';
import { getMultiProvider } from '../../context/context';
import { TransferFormValues } from '../transfer/types';
import { useAccountAddressForChain } from '../wallet/hooks/multiProtocol';

export function useOriginBalance({ origin, destination, token }: TransferFormValues) {
  const address = useAccountAddressForChain(origin);

  const { isLoading, isError, error, data } = useQuery({
    queryKey: ['useOriginBalance', address, origin, destination, token],
    queryFn: () => {
      if (!origin || !destination || !token || !address || !isValidAddress(address, token.protocol))
        return null;

      return token.getBalance(getMultiProvider(), address);
    },
    refetchInterval: 5000,
  });

  useToastError(error, 'Error fetching origin balance');

  return {
    isLoading,
    isError,
    balance: data ?? undefined,
  };
}

// TODO de-dupe with above when it's confirmed no difference is needed
// it may be there token is originToken and we need to find destinationToken
export function useDestinationBalance({
  origin,
  destination,
  token,
  recipient,
}: TransferFormValues) {
  const { isLoading, isError, error, data } = useQuery({
    queryKey: ['useDestinationBalance', recipient, origin, destination, token],
    queryFn: async () => {
      if (
        !origin ||
        !destination ||
        !token ||
        !recipient ||
        !isValidAddress(recipient, token.protocol)
      )
        return null;

      return token.getBalance(getMultiProvider(), recipient);
    },
    refetchInterval: 5000,
  });

  useToastError(error, 'Error fetching destination balance');

  return { isLoading, isError, balance: data ?? undefined };
}
