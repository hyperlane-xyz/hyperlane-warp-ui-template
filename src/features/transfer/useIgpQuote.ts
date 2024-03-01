import { useQuery } from '@tanstack/react-query';

import { IToken } from '@hyperlane-xyz/sdk';

import { useToastError } from '../../components/toast/useToastError';
import { getWarpCore } from '../../context/context';

//TODO remove
export function useIgpQuote(token?: IToken, destination?: ChainName, enabled = true) {
  const { isLoading, isError, error, data } = useQuery({
    queryKey: ['useIgpQuote', destination, token?.addressOrDenom],
    queryFn: () => {
      if (!token || !destination) return null;
      return getWarpCore().getTransferRemoteGasQuote(token, destination);
    },
    enabled,
  });

  useToastError(error, 'Error fetching IGP quote');

  return { isLoading, isError, igpQuote: data };
}
