import { ProtocolType } from '@hyperlane-xyz/utils';
import { useQuery } from '@tanstack/react-query';

import { useMultiProvider } from '../chains/hooks';
import { confirmationProgress, ProgressState, type ConfirmationProgress } from './progress';

export function useTransactionConfirmations(
  chain: string | undefined,
  txHash: string | undefined,
  enabled: boolean,
) {
  const multiProvider = useMultiProvider();
  const metadata = chain ? multiProvider.tryGetChainMetadata(chain) : undefined;
  const protocol = metadata?.protocol;
  const required = metadata?.blocks?.confirmations;
  const query = useQuery({
    queryKey: ['transactionConfirmations', chain, txHash, required, metadata?.rpcUrls],
    enabled: enabled && !!chain && !!txHash,
    queryFn: async (): Promise<ConfirmationProgress> => {
      if (!chain || !txHash) throw new Error('Missing transaction');
      if (protocol === ProtocolType.Sealevel) {
        const provider = multiProvider.getSolanaWeb3Provider(chain);
        const response = await provider.getSignatureStatuses([txHash], {
          searchTransactionHistory: true,
        });
        const status = response.value[0];
        if (!status)
          return {
            state: ProgressState.Pending,
            included: false,
            reason: 'Transaction not found yet',
          };
        if (status.err)
          return { state: ProgressState.Failed, included: true, reason: 'Transaction reverted' };
        return {
          included: true,
          state:
            status.confirmationStatus === 'finalized'
              ? ProgressState.Confirmed
              : ProgressState.Pending,
          reason:
            status.confirmationStatus === 'finalized' ? 'Finalized' : 'Waiting for finalization',
        };
      }
      if (protocol !== ProtocolType.Ethereum || required == null) {
        return {
          state: ProgressState.Unavailable,
          reason: 'Confirmation tracking unavailable for this chain',
        };
      }
      const provider = multiProvider.getEthersV5Provider(chain);
      const [receipt, head] = await Promise.all([
        provider.getTransactionReceipt(txHash),
        provider.getBlockNumber(),
      ]);
      if (!receipt)
        return {
          state: ProgressState.Pending,
          included: false,
          reason: 'Transaction not found; waiting for inclusion',
        };
      if (receipt.status === 0)
        return { state: ProgressState.Failed, included: true, reason: 'Transaction reverted' };
      return confirmationProgress(receipt.blockNumber, head, required);
    },
    staleTime: 5_000,
    refetchInterval: (q) =>
      q.state.data?.state === ProgressState.Confirmed ||
      q.state.data?.state === ProgressState.Failed ||
      q.state.data?.state === ProgressState.Unavailable
        ? false
        : 10_000,
  });
  return query;
}
