import { ProtocolType } from '@hyperlane-xyz/utils';
import { useQuery } from '@tanstack/react-query';

import { useMultiProvider } from '../chains/hooks';
import { LiveConnection } from './messageStream';
import { confirmationProgress, ProgressState, type ConfirmationProgress } from './progress';
import { useMessageStream } from './useMessageStream';

export function useTransactionConfirmations(
  chain: string | undefined,
  txHash: string | undefined,
  enabled: boolean,
  blockHeight?: number,
) {
  const multiProvider = useMultiProvider();
  const metadata = chain ? multiProvider.tryGetChainMetadata(chain) : undefined;
  const protocol = metadata?.protocol;
  const required = metadata?.blocks?.reorgPeriod;
  const head = useMessageStream((state) =>
    metadata ? state.heads[metadata.domainId ?? Number(metadata.chainId)] : undefined,
  );
  const connected = useMessageStream((state) => state.connection === LiveConnection.Connected);
  const liveProgress =
    connected &&
    protocol === ProtocolType.Ethereum &&
    typeof required === 'number' &&
    blockHeight != null &&
    head != null
      ? confirmationProgress(blockHeight, head, required)
      : undefined;
  const query = useQuery({
    queryKey: ['transactionConfirmations', chain, txHash, required, metadata?.rpcUrls],
    enabled: enabled && !!chain && !!txHash && !liveProgress,
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
        typeof required === 'number'
          ? provider.getBlockNumber()
          : provider.getBlock(required).then((block) => {
              if (!block) throw new Error(`Block tag ${required} unavailable on ${chain}`);
              return block.number;
            }),
      ]);
      if (!receipt)
        return {
          state: ProgressState.Pending,
          included: false,
          reason: 'Transaction not found; waiting for inclusion',
        };
      if (receipt.status === 0)
        return { state: ProgressState.Failed, included: true, reason: 'Transaction reverted' };
      if (typeof required === 'string') {
        const confirmed = head >= receipt.blockNumber;
        return {
          included: true,
          state: confirmed ? ProgressState.Confirmed : ProgressState.Pending,
          reason: confirmed ? `Reached ${required} block` : `Waiting for ${required} block`,
        };
      }
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
  return { ...query, data: liveProgress ?? query.data, isError: !liveProgress && query.isError };
}
