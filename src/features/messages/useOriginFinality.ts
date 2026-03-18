import { ProtocolType } from '@hyperlane-xyz/utils';
import { useQuery } from '@tanstack/react-query';
import { useMultiProvider } from '../chains/hooks';
import { DEFAULT_FINALITY_BLOCKS } from '../transfer/utils';

const POLL_INTERVAL_MS = 10_000;

/**
 * Checks if the origin tx is finalized by comparing latest block to origin block + finality blocks.
 * Only works for EVM chains; non-EVM returns false.
 */
export function useOriginFinality(
  origin: string | undefined,
  originBlockNumber: number | undefined,
  enabled: boolean,
): boolean {
  const multiProvider = useMultiProvider();

  const { data } = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps -- multiProvider is stable
    queryKey: ['originFinality', origin, originBlockNumber],
    queryFn: async () => {
      if (!origin || !originBlockNumber) return false;
      const protocol = multiProvider.tryGetProtocol(origin);
      if (protocol !== ProtocolType.Ethereum) return false;
      try {
        const metadata = multiProvider.tryGetChainMetadata(origin);
        const finalityBlocks = metadata?.blocks?.confirmations ?? DEFAULT_FINALITY_BLOCKS;
        const provider = multiProvider.getEthersV5Provider(origin);
        const latestBlock = await provider.getBlockNumber();
        return latestBlock > originBlockNumber + finalityBlocks;
      } catch {
        return false;
      }
    },
    enabled,
    refetchInterval: (query) => {
      if (query.state.data === true) return false;
      return POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: false,
  });

  return data ?? false;
}
