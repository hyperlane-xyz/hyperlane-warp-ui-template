import { EvmTokenAdapter, IToken } from '@hyperlane-xyz/sdk';
import { useAccountAddressForChain } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import { useToastError } from '../../components/toast/useToastError';
import { config } from '../../consts/config';
import { useMultiProvider } from '../chains/hooks';
import { useWarpCore } from './hooks';

export function useIsApproveRequired(token?: IToken, amount?: string, enabled = true) {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const owner = useAccountAddressForChain(multiProvider, token?.chainName);

  const { isLoading, isError, error, data } = useQuery({
    // The Token class is not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['useIsApproveRequired', owner, amount, token?.addressOrDenom],
    queryFn: async () => {
      if (!token || !owner || !amount) return false;
      return warpCore.isApproveRequired({ originTokenAmount: token.amount(amount), owner });
    },
    enabled,
  });

  useToastError(error, 'Error fetching approval status');

  return { isLoading, isError, isApproveRequired: !!data };
}

export function useIsUSDCBridgeFeeApproveRequired(
  originChain: string,
  destination: string,
  spenderAddress?: string,
  enabled = true,
) {
  const multiProvider = useMultiProvider();
  const owner = useAccountAddressForChain(multiProvider, originChain);

  const shouldCheck = enabled && !!spenderAddress && !!owner;

  const { isLoading, isError, error, data } = useQuery({
    queryKey: [
      'useIsUSDCBridgeFeeApproveRequired',
      owner,
      spenderAddress,
      destination,
      originChain,
    ],
    queryFn: async () => {
      if (!owner || !spenderAddress) return false;
      const bridgeFeeUSDC = config.pruvOriginFeeUSDC[destination];
      if (!bridgeFeeUSDC) return false;
      const usdcAmount = (
        bridgeFeeUSDC * Math.pow(10, config.pruvUSDCMetadata.decimals)
      ).toString();
      const usdcTokenAdapter = new EvmTokenAdapter(originChain, multiProvider, {
        token: config.pruvUSDCMetadata.address,
      });
      return usdcTokenAdapter.isApproveRequired(owner, spenderAddress, usdcAmount);
    },
    enabled: shouldCheck,
  });

  useToastError(error, 'Error fetching USDC bridge fee approval status');

  return { isLoading, isError, isUSDCApproveRequired: !!data };
}
