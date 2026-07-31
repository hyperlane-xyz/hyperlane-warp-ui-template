import {
  FeeQuotingNoQuoteAvailableError,
  FeeQuotingV2Client,
  type IToken,
  type QuotedTransferProvider,
  SealevelHypTokenAdapter,
  SealevelQuotedTransferProvider,
  SealevelTokenAdapter,
  type Token,
  TokenAmount,
  type WarpCore,
} from '@hyperlane-xyz/sdk';
import { ProtocolType, toWei } from '@hyperlane-xyz/utils';
import { useDebounce } from '@hyperlane-xyz/widgets';
import { useAccounts } from '@hyperlane-xyz/widgets/walletIntegrations/accounts';
import { getAccountAddressAndPubKey } from '@hyperlane-xyz/widgets/walletIntegrations/accountUtils';
import {
  ACCOUNT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  getAccountLenForMint,
  getMint,
} from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { config } from '../../consts/config';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { useWarpCore } from '../tokens/hooks';
import { TransferFormValues } from './types';

/**
 * Local Next.js API base — the proxy at `/api/v2/quote/[endpoint]` forwards
 * to the upstream fee-quoting service with the server-side API key. The
 * `FeeQuotingV2Client` appends `/v2/quote/{endpoint}?…` to this base, so the
 * combined URL hits the proxy route's `[endpoint].ts` handler.
 *
 * `apiKey` is empty for browser-side requests; the proxy injects the real
 * key when forwarding upstream.
 */
const PROXY_BASE_URL = '/api';

const FEE_QUOTE_REFRESH_INTERVAL = 30_000;

export interface SvmQuotedTransferResult {
  /**
   * `SealevelQuotedTransferProvider` for the current SVM route, or `null`
   * when the origin isn't Sealevel / route isn't quote-enabled / fee-quoting
   * config is missing. `useTokenTransfer` passes the value to
   * `WarpCore.getTransferRemoteTxs({ quotedTransfer })` when non-null.
   */
  quotedTransfer: QuotedTransferProvider | null;
  /**
   * Await-able provider getter for submit: re-runs `fee_config` discovery and
   * returns the provider once resolved, so a Send-click during the initial
   * discovery window doesn't fall through to the plain transfer path (the
   * memoized `quotedTransfer` is still null then). Mirrors the EVM
   * `getQuotedCallsParams`. Returns `null` when the route isn't quote-enabled.
   */
  getQuotedTransfer: () => Promise<QuotedTransferProvider | null>;
  /**
   * Priced fee tuple from the offchain quoter, ready to feed into
   * `ReviewDetails`. `null` when the route isn't quote-enabled / form is
   * incomplete / the upstream returned no quote. Submit re-fetches
   * independently inside `buildQuotedTransferTxs`.
   */
  fees: {
    interchainQuote: TokenAmount;
    tokenFeeQuote?: TokenAmount;
    localQuote: TokenAmount;
  } | null;
  isLoading: boolean;
}

/**
 * SVM-origin equivalent of `useQuotedCallsFeeQuotes`. Discovers `fee_config`
 * (one-shot per route), constructs the provider, then eagerly fetches the
 * offchain warp + IGP quote so `ReviewDetails` can show the priced fee
 * before submit. Submit (`useTokenTransfer` → `WarpCore.getTransferRemoteTxs`)
 * re-runs the same fetch inside `buildQuotedTransferTxs` — both calls hit
 * the same upstream and (for transient 0-fee servers) return identical
 * values, so display ↔ submit match.
 */
export function useSvmQuotedTransfer(
  { amount, recipient: formRecipient }: TransferFormValues,
  originToken: Token | undefined,
  destinationToken: IToken | undefined,
  enabled: boolean,
): SvmQuotedTransferResult {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();
  const debouncedAmount = useDebounce(amount, 500);

  const isSealevelOrigin = originToken?.protocol === ProtocolType.Sealevel;
  const destinationName = destinationToken?.chainName;
  const originName = originToken?.chainName;
  const shouldDiscover =
    enabled && isSealevelOrigin && !!destinationName && !!originName && !!config.feeQuotingUrl;

  // 1. Discover fee_config by reading the warp token PDA. Cached per route —
  //    the fee program / fee-account PDA are static for the life of the route.
  const {
    data: feeConfig,
    isLoading: isFeeConfigLoading,
    refetch: refetchFeeConfig,
  } = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps -- queryFn closes
    // over multiProvider + originToken (instances, can't stringify); chainName
    // + addressOrDenom in the key cover route identity.
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
        logger.debug('useSvmQuotedTransfer: adapter is not Sealevel; skipping fee-config probe');
        return null;
      }
      const tokenData = await adapter.getTokenAccountData();
      return tokenData.fee_config ?? null;
    },
    enabled: shouldDiscover,
  });

  // Provider factory — the provider itself only needs the origin connection;
  // `fee_config` gates whether the route is quote-enabled, not the construction.
  const buildQuotedTransfer = useCallback(
    (chainName: string): QuotedTransferProvider =>
      new SealevelQuotedTransferProvider({
        feeQuotingClient: new FeeQuotingV2Client({
          baseUrl: PROXY_BASE_URL,
          // Browser-side: real key lives in the Next.js proxy at /api/v2/quote.
          apiKey: '',
        }),
        connection: multiProvider.getSolanaWeb3Provider(chainName),
      }),
    [multiProvider],
  );

  // 2. Memoize the provider. Constructed only when fee_config exists —
  //    submit calls `buildQuotedTransferTxs` on this same instance.
  const quotedTransfer = useMemo<QuotedTransferProvider | null>(() => {
    if (!shouldDiscover || !feeConfig || !originName) return null;
    return buildQuotedTransfer(originName);
  }, [shouldDiscover, feeConfig, originName, buildQuotedTransfer]);

  // 3. Resolve sender + recipient for the display-time fee fetch.
  const { accounts } = useAccounts(multiProvider);
  const { address: sender } = getAccountAddressAndPubKey(multiProvider, originName, accounts);
  const { address: connectedDestAddress } = getAccountAddressAndPubKey(
    multiProvider,
    destinationName,
    accounts,
  );
  const recipient = formRecipient || connectedDestAddress || '';

  const shouldFetchFees =
    !!quotedTransfer &&
    !!originToken &&
    !!destinationToken &&
    !!destinationName &&
    !!debouncedAmount &&
    !!sender &&
    !!recipient;

  // 4. Eagerly fetch the priced fee tuple from the offchain quoter so
  //    ReviewDetails can show the actual value the on-chain program will
  //    apply. Submit re-fetches via the provider's `buildQuotedTransferTxs`;
  //    transient quotes are server-deterministic for the same input so the
  //    two fetches resolve to the same fee value.
  const {
    data: fees,
    isLoading: isFeesLoading,
    error: feesError,
  } = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps -- queryFn
    // closes over warpCore + quotedTransfer + tokens (instances). Identity is
    // covered by addressOrDenom + chainName fields below.
    queryKey: [
      'svmQuotedTransferFee',
      originToken?.chainName,
      originToken?.addressOrDenom,
      destinationToken?.chainName,
      destinationToken?.addressOrDenom,
      sender,
      recipient,
      debouncedAmount,
    ],
    queryFn: () =>
      fetchSvmQuotedFees({
        warpCore,
        quotedTransfer: quotedTransfer!,
        originToken: originToken!,
        destinationToken: destinationToken!,
        destination: destinationName!,
        sender: sender!,
        recipient,
        amount: debouncedAmount,
      }),
    enabled: shouldFetchFees,
    refetchInterval: FEE_QUOTE_REFRESH_INTERVAL,
  });

  // Only an explicit no-quote response (the typed `FeeQuotingNoQuoteAvailableError`,
  // e.g. `not_configured`) means the route can't be quoted — that's the sole
  // case where submit should fall through to the plain path. Transient failures
  // (502/timeout, RPC, tx-construction) must NOT downgrade: they leave the
  // provider in place so submit stays on the quoted path and fails loudly
  // instead of silently sending a different transaction. This also keeps display
  // and submit coherent — on a failed background refetch TanStack retains the
  // prior `fees`, so the review panel keeps showing the offchain quote.
  const isNoQuoteAvailable =
    shouldFetchFees && !isFeesLoading && feesError instanceof FeeQuotingNoQuoteAvailableError;

  // Submit-time getter: await `fee_config` discovery (still in-flight on a quick
  // Send-click) and return the provider unless the route explicitly has no quote.
  const getQuotedTransfer = useCallback(async (): Promise<QuotedTransferProvider | null> => {
    if (!shouldDiscover || !originName || isNoQuoteAvailable) return null;
    const { data } = await refetchFeeConfig();
    return data ? buildQuotedTransfer(originName) : null;
  }, [shouldDiscover, originName, isNoQuoteAvailable, refetchFeeConfig, buildQuotedTransfer]);

  return {
    quotedTransfer,
    getQuotedTransfer,
    fees: fees ?? null,
    isLoading: (shouldDiscover && isFeeConfigLoading) || (shouldFetchFees && isFeesLoading),
  };
}

async function fetchSvmQuotedFees({
  warpCore,
  quotedTransfer,
  originToken,
  destinationToken,
  destination,
  sender,
  recipient,
  amount,
}: {
  warpCore: WarpCore;
  quotedTransfer: QuotedTransferProvider;
  originToken: Token;
  destinationToken: IToken;
  destination: string;
  sender: string;
  recipient: string;
  amount: string;
}): Promise<{
  interchainQuote: TokenAmount;
  tokenFeeQuote?: TokenAmount;
  localQuote: TokenAmount;
} | null> {
  const amountWei = toWei(amount, originToken.decimals);
  const originTokenAmount = originToken.amount(amountWei);

  const { igpQuote, tokenFeeQuote } = await warpCore.getQuotedTransferFee({
    quotedTransfer,
    originTokenAmount,
    destination,
    sender,
    recipient,
    destinationToken,
  });

  // Estimate the ACTUAL quoted transaction the user will submit: it prepends
  // `SubmitFeeQuote` / `SubmitIgpQuote` ixs and extra signers that the SDK's
  // `getLocalTransferFeeAmount` (no `quotedTransfer` input) omits by building a
  // plain transfer. Build the same txs as submit and sum their per-tx fees,
  // reusing the native token from `igpQuote`. A throw here drops the whole
  // offchain result, letting the consumer fall through to on-chain quoting.
  const quotedTxs = await warpCore.getTransferRemoteTxs({
    originTokenAmount,
    destination,
    sender,
    recipient,
    quotedTransfer,
    destinationToken,
  });
  let localFeeAmount = 0n;
  for (const tx of quotedTxs) {
    const { fee } = await warpCore.multiProvider.estimateTransactionFee({
      chainNameOrId: originToken.chainName,
      transaction: tx,
      sender,
    });
    localFeeAmount += BigInt(fee);
  }
  const localQuote = new TokenAmount(localFeeAmount, igpQuote.token);

  // On a same-chain swap the recipient's destination-token ATA is created in the
  // same transaction, and its rent-exempt deposit is paid by the sender — a cost
  // Solana's `getFeeForMessage` (behind `localQuote`) never reports. Fold it into
  // the local gas so it's part of the origin-chain cost the wallet will charge,
  // rather than leaking a protocol-specific fee field. Cross-chain rent is
  // instead approximated on the interchain quote by `getInterchainQuote`.
  const rentLamports = await getSameChainAtaRent({
    warpCore,
    originToken,
    destinationToken,
    destination,
    recipient,
  });

  return {
    interchainQuote: igpQuote,
    tokenFeeQuote,
    localQuote: rentLamports ? localQuote.plus(rentLamports) : localQuote,
  };
}

/**
 * Native-token rent (lamports) the sender pays in-transaction to create the
 * recipient's destination-token ATA, returned only for same-chain swaps where
 * that account is missing. Computed from the rent-exempt minimum for the actual
 * receive-account size — 165 bytes for classic SPL, or the extension-aware size
 * derived from the mint for Token-2022 — not a hard-coded estimate.
 *
 * Returns `undefined` when: not same-chain, the destination adapter isn't
 * Sealevel, or the ATA already exists on chain.
 */
export async function getSameChainAtaRent({
  warpCore,
  originToken,
  destinationToken,
  destination,
  recipient,
}: {
  warpCore: WarpCore;
  originToken: Token;
  destinationToken: IToken;
  destination: string;
  recipient: string;
}): Promise<bigint | undefined> {
  if (originToken.chainName !== destination) return undefined;

  const adapter = destinationToken.getAdapter(warpCore.multiProvider);
  if (!(adapter instanceof SealevelTokenAdapter)) return undefined;

  const connection = warpCore.multiProvider.getSolanaWeb3Provider(destination);
  const recipientAta = await adapter.deriveAssociatedTokenAccount(new PublicKey(recipient));
  const ataInfo = await connection.getAccountInfo(recipientAta);
  if (ataInfo) return undefined;

  const accountSize = (await adapter.isSpl2022())
    ? getAccountLenForMint(
        await getMint(connection, adapter.tokenMintPubKey, undefined, TOKEN_2022_PROGRAM_ID),
      )
    : ACCOUNT_SIZE;

  return BigInt(await connection.getMinimumBalanceForRentExemption(accountSize));
}
