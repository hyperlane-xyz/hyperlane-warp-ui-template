import { useQuery } from '@tanstack/react-query';

import { Token } from '@hyperlane-xyz/sdk';

import { useToastError } from '../../components/toast/useToastError';
import { getWarpCore } from '../../context/context';
import { useAccountAddressForChain } from '../wallet/hooks/multiProtocol';

export function useIsApproveRequired(token?: Token, amount?: string, enabled = true) {
  const owner = useAccountAddressForChain(token?.chainName);

  const { isLoading, isError, error, data } = useQuery({
    queryKey: ['useIsApproveRequired', token, owner, amount],
    queryFn: async () => {
      if (!token || !owner || !amount) return false;
      return getWarpCore().isApproveRequired(token.amount(amount), owner);
    },
    enabled,
  });

  useToastError(error, 'Error fetching approval status');

  return { isLoading, isError, isApproveRequired: !!data };
}
