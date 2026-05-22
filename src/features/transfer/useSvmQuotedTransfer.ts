import {
  FeeQuotingV2Client,
  type IToken,
  type QuotedTransferProvider,
  SealevelHypTokenAdapter,
  SealevelQuotedTransferProvider,
  type Token,
} from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { config } from '../../consts/config';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { useWarpCore } from '../tokens/hooks';

/**
 * Local Next.js API base — the proxy at `/api/v2/quote/[endpoint]` forwards
 * to the upstream fee-quoting service with the server-side API key. The
 * `FeeQuotingV2Client` appends `/v2/quote/{endpoint}?…` to this base, so the
 * combined URL hits the proxy route's `[endpoint].ts` handler.
 *
 * `apiKey` is empty for browser-side requests; the proxy injects the real
 * key when forwarding upstream. Same shape as the v1 `/api/quote` proxy.
 */
const PROXY_BASE_URL = '/api';

export interface SvmQuotedTransferResult {
  /**
   * Memoized `SealevelQuotedTransferProvider` for the current SVM route, or
   * `null` when the origin isn't Sealevel / route isn't quote-enabled /
   * fee-quoting config is missing. `useTokenTransfer` passes the value to
   * `WarpCore.getTransferRemoteTxs({ quotedTransfer })` when non-null.
   */
  quotedTransfer: QuotedTransferProvider | null;
  isLoading: boolean;
}

/**
 * Builds a `SealevelQuotedTransferProvider` for Sealevel origins when the
 * fee-quoting proxy is configured. The provider itself defers the warp
 * quote fetch until `buildQuotedTransferTxs` is called at submit time;
 * this hook's job is just to discover the `fee_config` (fee program +
 * fee account PDA) once per route and memoize the provider.
 *
 * Parallel to `useQuotedCallsFeeQuotes` for EVM, but minimal — SVM
 * placeholder pricing means there's no fee preview to show in the UI.
 */
export function useSvmQuotedTransfer(
  originToken: Token | undefined,
  destinationToken: IToken | undefined,
  enabled: boolean,
): SvmQuotedTransferResult {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const isSealevelOrigin = originToken?.protocol === ProtocolType.Sealevel;
  const destinationName = destinationToken?.chainName;
  const originName = originToken?.chainName;
  const shouldFetch =
    enabled &&
    isSealevelOrigin &&
    !!destinationName &&
    !!originName &&
    !!config.feeQuotingUrl;

  // Discover fee_config by reading the warp token PDA. Cached per route — the
  // fee program / fee-account PDA are static for the life of the warp route.
  const { data: feeConfig, isLoading } = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps -- queryFn closes
    // over multiProvider + warpCore + originToken (instances, can't stringify);
    // chainName + addressOrDenom in the key cover route identity.
    queryKey: [
      'svmFeeConfig',
      originToken?.chainName,
      originToken?.addressOrDenom,
      destinationName,
    ],
    queryFn: async () => {
      if (!originToken || !destinationName) return null;
      const adapter = originToken.getHypAdapter(multiProvider, destinationName);
      if (!(adapter instanceof SealevelHypTokenAdapter)) {
        logger.debug(
          'useSvmQuotedTransfer: adapter is not Sealevel; skipping fee-config probe',
        );
        return null;
      }
      const tokenData = await adapter.getTokenAccountData();
      return tokenData.fee_config ?? null;
    },
    enabled: shouldFetch,
  });

  const quotedTransfer = useMemo<QuotedTransferProvider | null>(() => {
    if (!shouldFetch || !feeConfig || !originName) return null;
    return new SealevelQuotedTransferProvider({
      feeQuotingClient: new FeeQuotingV2Client({
        baseUrl: PROXY_BASE_URL,
        // Browser-side: real key lives in the Next.js proxy at /api/v2/quote.
        apiKey: '',
      }),
      connection: multiProvider.getSolanaWeb3Provider(originName),
      feeProgramId: feeConfig.feeProgram,
      feeAccount: feeConfig.feeAccount,
    });
  }, [shouldFetch, feeConfig, originName, multiProvider, warpCore]);

  return {
    quotedTransfer,
    isLoading: shouldFetch && isLoading,
  };
}
