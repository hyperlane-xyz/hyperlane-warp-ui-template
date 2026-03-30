import type { IToken } from '@hyperlane-xyz/sdk/token/IToken';
import { useQuery } from '@tanstack/react-query';

import { useToastError } from '../../components/toast/useToastError';
import { useMultiProvider } from '../chains/hooks';
import { getRuntimeProtocols } from '../hyperlane/runtimeProtocols';
import { useStore } from '../store';
import { getRouteAccountAddressForChain } from '../wallet/routeAccounts';
import { useReadyWarpCore } from './hooks';

export function useIsApproveRequired(token?: IToken, amount?: string, enabled = true) {
  const multiProvider = useMultiProvider();
  const warpCore = useReadyWarpCore();
  const { ensureWarpRuntime, routeAccounts } = useStore((s) => ({
    ensureWarpRuntime: s.ensureWarpRuntime,
    routeAccounts: s.routeAccounts,
  }));

  const owner = getRouteAccountAddressForChain(multiProvider, token?.chainName, routeAccounts);
  const runtimeProtocols = getRuntimeProtocols([token?.protocol]);

  const { isLoading, isError, error, data } = useQuery({
    // The Token class is not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['useIsApproveRequired', owner, amount, token?.addressOrDenom],
    queryFn: async () => {
      const readyWarpCore = warpCore || (await ensureWarpRuntime(runtimeProtocols));
      if (!readyWarpCore) return false;
      if (!token || !owner || !amount) return false;
      return readyWarpCore.isApproveRequired({ originTokenAmount: token.amount(amount), owner });
    },
    enabled,
  });

  useToastError(error, 'Error fetching approval status');

  return { isLoading, isError, isApproveRequired: !!data };
}
