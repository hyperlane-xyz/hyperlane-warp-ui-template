import { useQuery } from '@tanstack/react-query';

import { IToken } from '@hyperlane-xyz/sdk';

import { useToastError } from '../../components/toast/useToastError';
import { getWarpCore } from '../../context/context';

export function useIgpQuote(token?: IToken, destination?: ChainName) {
  const { isLoading, isError, error, data } = useQuery({
    queryKey: ['useIgpQuote', destination, token?.addressOrDenom],
    queryFn: () => {
      if (!token || !destination) return null;
      return getWarpCore().getTransferGasQuote(token, destination);
    },
  });

  useToastError(error, 'Error fetching IGP quote');

  return { isLoading, isError, igpQuote: data };
}
