import type { MultiProtocolProvider } from '@hyperlane-xyz/sdk/providers/MultiProtocolProvider';
import type { ChainName } from '@hyperlane-xyz/sdk/types';
import { useQuery } from '@tanstack/react-query';

import { logger } from '../../utils/logger';

const DEST_SWAP_POLL_INTERVAL_MS = 5_000;

async function getSolanaDestSwapStatus({
  pdaAddress,
  destinationChain,
  multiProvider,
}: {
  pdaAddress: string;
  destinationChain: ChainName;
  multiProvider: MultiProtocolProvider;
}): Promise<{ isDone: boolean }> {
  try {
    const rpcUrl = multiProvider.tryGetChainMetadata(destinationChain)?.rpcUrls?.[0]?.http;
    if (!rpcUrl) return { isDone: false };
    const { Connection, PublicKey } = await import('@solana/web3.js');
    const connection = new Connection(rpcUrl, 'confirmed');
    const accountInfo = await connection.getAccountInfo(new PublicKey(pdaAddress));
    // PDA is closed (null) once the CCS relayer executes the Reveal instruction
    // and the dest swap completes. Before delivery it's also null, so this hook
    // must only be enabled after the bridge message has been delivered.
    return { isDone: accountInfo === null };
  } catch (err) {
    logger.warn('Solana dest swap PDA check failed', err as Error);
    return { isDone: false };
  }
}

export function useSolanaDestSwapStatus({
  pdaAddress,
  destinationChain,
  multiProvider,
  enabled,
}: {
  pdaAddress: string | undefined;
  destinationChain: ChainName | undefined;
  multiProvider: MultiProtocolProvider;
  enabled: boolean;
}) {
  const { data } = useQuery({
    queryKey: ['solanaDestSwapStatus', destinationChain, pdaAddress],
    queryFn: async () => {
      if (!pdaAddress || !destinationChain) return { isDone: false };
      return getSolanaDestSwapStatus({ pdaAddress, destinationChain, multiProvider });
    },
    enabled: enabled && !!pdaAddress && !!destinationChain,
    refetchInterval: (query) => {
      if (query.state.data?.isDone) return false;
      return DEST_SWAP_POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: false,
  });

  return { isDone: data?.isDone ?? false };
}
