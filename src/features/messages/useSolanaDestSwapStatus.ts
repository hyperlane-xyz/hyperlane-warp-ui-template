import type { ChainName, MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

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
}): Promise<{ exists: boolean }> {
  try {
    const rpcUrl = multiProvider.tryGetChainMetadata(destinationChain)?.rpcUrls?.[0]?.http;
    if (!rpcUrl) return { exists: false };
    const connection = connectionForRpcUrl(rpcUrl);
    const accountInfo = await connection.getAccountInfo(new PublicKey(pdaAddress));
    return { exists: accountInfo !== null };
  } catch (err) {
    logger.warn('Solana dest swap PDA check failed', err as Error);
    return { exists: false };
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
  const hasSeenAccount = useRef(false);
  const { data } = useQuery({
    queryKey: ['solanaDestSwapStatus', destinationChain, pdaAddress],
    queryFn: async () => {
      if (!pdaAddress || !destinationChain) return { exists: false };
      return getSolanaDestSwapStatus({ pdaAddress, destinationChain, multiProvider });
    },
    enabled: enabled && !!pdaAddress && !!destinationChain,
    refetchInterval: (query) => {
      if (hasSeenAccount.current && query.state.data?.exists === false) return false;
      return DEST_SWAP_POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    hasSeenAccount.current = false;
  }, [destinationChain, pdaAddress]);

  useEffect(() => {
    if (data?.exists) hasSeenAccount.current = true;
  }, [data?.exists]);

  return { isDone: hasSeenAccount.current && data?.exists === false };
}
