import type { ChainName, MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { logger } from '../../utils/logger';

const DEST_SWAP_POLL_INTERVAL_MS = 5_000;
const CLEAN_MISSING_CONFIRMATIONS = 2;
const MAX_SOLANA_DEST_SWAP_POLLS = 24;
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
  const cleanMissingCount = useRef(0);
  const pollCount = useRef(0);
  const [isDone, setIsDone] = useState(false);

  const { data } = useQuery({
    queryKey: ['solanaDestSwapStatus', destinationChain, pdaAddress],
    queryFn: async () => {
      if (!pdaAddress || !destinationChain) return { exists: false };
      return getSolanaDestSwapStatus({ pdaAddress, destinationChain, multiProvider });
    },
    enabled: enabled && !!pdaAddress && !!destinationChain,
    refetchInterval: (query) => {
      if (isDone || pollCount.current >= MAX_SOLANA_DEST_SWAP_POLLS) return false;
      return DEST_SWAP_POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    cleanMissingCount.current = 0;
    pollCount.current = 0;
    setIsDone(false);
  }, [destinationChain, pdaAddress, enabled]);

  useEffect(() => {
    if (!enabled || !data) return;
    pollCount.current += 1;
    if (data.errored) return;
    if (data.exists) {
      cleanMissingCount.current = 0;
      return;
    }

    cleanMissingCount.current += 1;
    if (cleanMissingCount.current >= CLEAN_MISSING_CONFIRMATIONS) setIsDone(true);
  }, [data, enabled]);

  return { isDone };
}
