import type { ChainName, MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { logger } from '../../utils/logger';

const DEST_SWAP_POLL_INTERVAL_MS = 5_000;
const CLEAN_MISSING_CONFIRMATIONS = 2;
const MAX_SOLANA_DEST_SWAP_POLLS = 24;
const connectionByRpcUrl = new Map<string, Connection>();

export type SolanaDestSwapPollResult = { exists: boolean; errored?: boolean };
export type SolanaDestSwapPollState = {
  cleanMissingCount: number;
  pollCount: number;
  isDone: boolean;
};

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
}): Promise<SolanaDestSwapPollResult> {
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

  const { data, dataUpdatedAt } = useQuery({
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
    const next = nextSolanaDestSwapPollState(
      {
        cleanMissingCount: cleanMissingCount.current,
        pollCount: pollCount.current,
        isDone,
      },
      data,
    );
    cleanMissingCount.current = next.cleanMissingCount;
    pollCount.current = next.pollCount;
    if (next.isDone && !isDone) setIsDone(true);
  }, [data, dataUpdatedAt, enabled, isDone]);

  return { isDone };
}

export function nextSolanaDestSwapPollState(
  state: SolanaDestSwapPollState,
  result: SolanaDestSwapPollResult,
): SolanaDestSwapPollState {
  const pollCount = state.pollCount + 1;
  if (result.errored) return { ...state, pollCount };
  const cleanMissingCount = result.exists ? 0 : state.cleanMissingCount + 1;
  return {
    pollCount,
    cleanMissingCount,
    isDone: state.isDone || cleanMissingCount >= CLEAN_MISSING_CONFIRMATIONS,
  };
}
