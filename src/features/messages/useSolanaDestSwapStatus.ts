import type { ChainName, MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { useQuery } from '@tanstack/react-query';

import { logger } from '../../utils/logger';

const DEST_SWAP_POLL_INTERVAL_MS = 5_000;
const connectionByRpcUrl = new Map<string, Connection>();

function connectionForRpcUrl(rpcUrl: string): Connection {
  const cached = connectionByRpcUrl.get(rpcUrl);
  if (cached) return cached;
  const connection = new Connection(rpcUrl, 'confirmed');
  connectionByRpcUrl.set(rpcUrl, connection);
  return connection;
}

async function getSolanaDestSwapStatus({
  pdaAddress,
  destinationChain,
  multiProvider,
}: {
  pdaAddress: string;
  destinationChain: ChainName;
  multiProvider: MultiProtocolProvider;
}): Promise<{ exists: boolean; errored?: boolean }> {
  try {
    const rpcUrl = multiProvider.tryGetChainMetadata(destinationChain)?.rpcUrls?.[0]?.http;
    if (!rpcUrl) return { exists: false, errored: true };
    const connection = connectionForRpcUrl(rpcUrl);
    const accountInfo = await connection.getAccountInfo(new PublicKey(pdaAddress));
    return { exists: accountInfo !== null };
  } catch (err) {
    logger.warn('Solana dest swap PDA check failed', err as Error);
    return { exists: false, errored: true };
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
      if (!pdaAddress || !destinationChain) return { exists: false };
      return getSolanaDestSwapStatus({ pdaAddress, destinationChain, multiProvider });
    },
    enabled: enabled && !!pdaAddress && !!destinationChain,
    refetchInterval: (query) => {
      if (query.state.data?.exists === false && !query.state.data.errored) return false;
      return DEST_SWAP_POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: false,
  });

  return { isDone: data?.exists === false && !data.errored };
}
