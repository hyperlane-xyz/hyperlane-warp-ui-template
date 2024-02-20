import { useQuery } from '@tanstack/react-query';

import { Token } from '@hyperlane-xyz/sdk';

import { useToastError } from '../../components/toast/useToastError';
import { getWarpCore } from '../../context/context';

export function useIgpQuote(token?: Token, destination?: ChainName) {
  const { isLoading, isError, error, data } = useQuery({
    queryKey: ['useIgpQuote', token, destination],
    queryFn: () => {
      if (!token || !destination) return null;
      return getWarpCore().getTransferGasQuote(token, destination);
    },
  });

  useToastError(error, 'Error fetching IGP quote');

  return { isLoading, isError, igpQuote: data };
}
