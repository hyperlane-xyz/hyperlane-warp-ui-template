import type { Token } from '@hyperlane-xyz/sdk';
import { objLength, toWei } from '@hyperlane-xyz/utils';
import { useDebounce, useModal } from '@hyperlane-xyz/widgets';
import { useAccounts } from '@hyperlane-xyz/widgets/walletIntegrations/accounts';
import { useAccountAddressForChain } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { Form, Formik, useFormikContext } from 'formik';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatUnits, type Address } from 'viem';

import { FormWarningBanner } from '../../components/banner/FormWarningBanner';
import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { SolidButton } from '../../components/buttons/SolidButton';
import { RouteIcon } from '../../components/icons/RouteIcon';
import { SwapIcon } from '../../components/icons/SwapIcon';
import { TextField } from '../../components/input/TextField';
import { TransferSection } from '../../components/layout/TransferSection';
import { useToastError } from '../../components/toast/useToastError';
import { WARP_QUERY_PARAMS } from '../../consts/args';
import { config } from '../../consts/config';
import { updateQueryParams } from '../../utils/queryParams';
import { useChains } from '../api/hooks';
import { useMultiProvider } from '../chains/hooks';
import { TransactionHistoryItemType, useStore } from '../store';
import { RecipientConfirmationModal } from '../wallet/RecipientConfirmationModal';
import { WalletConnectionWarning } from '../wallet/WalletConnectionWarning';
import { WalletDropdown } from '../wallet/WalletDropdown';
import { ApprovalPhase, useApprovalStatus } from '../swap/approval';
import { useTokenBalance } from '../swap/balances/hooks';
import { formatDisplayAmount, formatUsd } from '../swap/balances/utils';
import { FeeSectionButton } from '../swap/FeeSectionButton';
import { FeeSectionButton as BridgeFeeSectionButton } from '../transfer/FeeSectionButton';
import { getInterchainQuote, getTotalFee } from '../transfer/fees';
import { useFeeQuotes } from '../transfer/useFeeQuotes';
import { useFeePrices } from '../balances/useFeePrices';
import { MaxButton } from '../swap/MaxButton';
import { RouteSelectionModal } from '../swap/routeSelection/RouteSelectionModal';
import { SlippagePanel } from '../swap/SlippagePanel';
import { TokenBalance } from '../swap/TokenBalance';
import { useTokenByKeyMap as useEngineTokenByKeyMap } from '../swap/tokens/hooks';
import { useTokenPrices, useTokenUsdValue } from '../swap/tokens/useTokenPrice';
import {
  FinalSwapStatuses,
  SwapStatus,
  type AugmentedRoute,
  type SwapFormValues,
  type SwapHistoryItem,
} from '../swap/types';
import { useQuote } from '../swap/useQuote';
import { useSwap } from '../swap/useSwap';
import { validateSwapForm } from '../swap/validate';
import { TransferFormValues } from '../transfer/types';
import { useTokenTransfer } from '../transfer/useTokenTransfer';
import { useIsApproveRequired } from '../tokens/approval';
import { useWarpCoreTokens } from '../tokens/hooks';
import { findConnectedDestinationToken, getTokenKey as getWarpTokenKey } from '../tokens/utils';
import { isHypNativeStandard } from './warpUtils';
import {
  getCombinedTokenByKey,
  useAllWarpCombinedTokens,
  useCombinedTokenMap,
  useWarpDestinations,
} from './hooks';
import type { CombinedToken, RouteMode } from './types';
import { MergedTokenSelectField } from './tokens/MergedTokenSelectField';

// The initial slippage and default empty form state.
const EMPTY_VALUES: SwapFormValues = {
  srcChain: null,
  dstChain: null,
  srcToken: '',
  dstToken: '',
  amount: '',
  recipient: '',
  slippageBps: config.defaultSlippageBps,
};

export function CombinedTransferForm() {
  return (
    <Formik<SwapFormValues>
      initialValues={EMPTY_VALUES}
      enableReinitialize
      onSubmit={() => undefined}
      validateOnChange={false}
      validateOnBlur={false}
    >
      <Form className="combined-form flex w-full flex-col items-stretch gap-1.5">
        <CombinedFormContent />
      </Form>
    </Formik>
  );
}

function useBridgeFeeData(
  srcToken: CombinedToken | undefined,
  dstToken: CombinedToken | undefined,
  amount: string,
  recipient: string,
) {
  const rawTokens = useWarpCoreTokens();
  const { prices } = useTokenPrices();

  const destinationToken = useMemo(
    () => (dstToken?.warpCoreKey ? rawTokens.find((t) => getWarpTokenKey(t) === dstToken.warpCoreKey) : undefined),
    [dstToken?.warpCoreKey, rawTokens],
  );

  // Find a source-chain raw token that has a direct connection to the destination.
  // Multiple tokens can share the same collateral address (e.g. USDC and USDCSTAGE both
  // collateralized by the real USDC contract). Prefer the one whose symbol matches the
  // token the user actually selected so we don't quote fees for a staging variant.
  const originToken = useMemo(() => {
    if (!srcToken || !destinationToken) return undefined;
    const srcNormalized = srcToken.address.toLowerCase();
    const candidates = rawTokens.filter((t) => {
      if (t.chainName !== srcToken.chainName) return false;
      if (!findConnectedDestinationToken(t, destinationToken)) return false;
      // Native tokens: engine stores 0x000...0000, WarpCore stores router contract.
      if (srcToken.isNative) return isHypNativeStandard(t.standard);
      return (
        t.collateralAddressOrDenom?.toLowerCase() === srcNormalized ||
        t.addressOrDenom.toLowerCase() === srcNormalized
      );
    });
    return candidates.find((t) => t.symbol === srcToken.symbol) ?? candidates[0];
  }, [srcToken, destinationToken, rawTokens]);

  const formValues = useMemo(
    (): TransferFormValues => ({
      originTokenKey: originToken ? getWarpTokenKey(originToken) : undefined,
      destinationTokenKey: destinationToken ? getWarpTokenKey(destinationToken) : undefined,
      amount,
      recipient: recipient as Address,
    }),
    [originToken, destinationToken, amount, recipient],
  );

  const enabled = !!(originToken && destinationToken && amount && Number(amount) > 0);
  const { isLoading, isError, fees: rawFees } = useFeeQuotes(
    formValues,
    enabled,
    originToken as Token | undefined,
    destinationToken,
    false,
  );

  const feePrices = useFeePrices(rawFees ?? null, rawTokens, prices);
  const tokenPrice = srcToken?.coinGeckoId ? prices[srcToken.coinGeckoId] : undefined;
  const parsedAmount = parseFloat(amount);
  const transferUsd = tokenPrice && !isNaN(parsedAmount) ? parsedAmount * tokenPrice : 0;

  const fees = useMemo(() => {
    if (!rawFees) return null;
    const interchainQuote = getInterchainQuote(originToken as Token | undefined, rawFees.interchainQuote);
    const merged = { ...rawFees, interchainQuote: interchainQuote || rawFees.interchainQuote };
    const totalFees = getTotalFee(merged)
      .map((fee) => `${fee.getDecimalFormattedAmount().toFixed(8)} ${fee.token.symbol}`)
      .join(', ');
    return { ...merged, totalFees };
  }, [rawFees, originToken]);

  return { isLoading, isError, fees, feePrices, transferUsd, originToken, destinationToken };
}

function CombinedFormContent() {
  const { values, errors, setErrors, setFieldValue, setValues } =
    useFormikContext<SwapFormValues>();
  const multiProvider = useMultiProvider();
  const combinedMap = useCombinedTokenMap();
  const { data: chainsResp } = useChains();
  useTokenPrices();

  const srcChainName = useMemo(
    () =>
      values.srcChain != null
        ? (multiProvider.tryGetChainName(values.srcChain) ?? undefined)
        : undefined,
    [values.srcChain, multiProvider],
  );
  const dstChainName = useMemo(
    () =>
      values.dstChain != null
        ? (multiProvider.tryGetChainName(values.dstChain) ?? undefined)
        : undefined,
    [values.dstChain, multiProvider],
  );

  useAccounts(multiProvider, config.addressBlacklist);
  const sender = useAccountAddressForChain(multiProvider, srcChainName);
  const connectedDestAddress = useAccountAddressForChain(multiProvider, dstChainName);
  const effectiveRecipient = values.recipient || connectedDestAddress || '';

  const srcTokenKey =
    values.srcChain != null && values.srcToken
      ? `${values.srcChain}-${values.srcToken.toLowerCase()}`
      : undefined;
  const dstTokenKey =
    values.dstChain != null && values.dstToken
      ? `${values.dstChain}-${values.dstToken.toLowerCase()}`
      : undefined;
  const srcToken = getCombinedTokenByKey(combinedMap, srcTokenKey);
  const dstToken = getCombinedTokenByKey(combinedMap, dstTokenKey);

  // All WarpCore tokens (includes non-EVM like Solana/Radix/Aleo) for the origin picker.
  const allWarpTokens = useAllWarpCombinedTokens();
  // WarpCore destinations for the current origin (shown in destination picker).
  const warpDestinations = useWarpDestinations(values.srcChain, values.srcToken, srcToken?.isNative);

  // All WarpCore tokens for the destination picker. Bridge-reachable ones from the current
  // origin keep their warpCoreKey (→ Bridge badge). Non-reachable ones (e.g. Cosmos, Starknet
  // on a different route) appear without any badge so they're still visible and selectable.
  const destinationExtraTokens = useMemo(() => {
    const reachableKeys = new Set(warpDestinations.map((t) => `${t.chainId}-${t.address.toLowerCase()}`));
    const reachableNativeChains = new Set(
      warpDestinations.filter((t) => t.isNative).map((t) => t.chainId),
    );
    return allWarpTokens.map((t) => {
      const key = `${t.chainId}-${t.address.toLowerCase()}`;
      const isReachable = reachableKeys.has(key) || (t.isNative && reachableNativeChains.has(t.chainId));
      if (isReachable) {
        const dst = t.isNative
          ? warpDestinations.find((d) => d.isNative && d.chainId === t.chainId)
          : warpDestinations.find((d) => `${d.chainId}-${d.address.toLowerCase()}` === key);
        return dst ?? t;
      }
      return { ...t, warpCoreKey: undefined, canBridge: false };
    });
  }, [allWarpTokens, warpDestinations]);

  // When the origin token changes, auto-set destination to the first bridge destination.
  const prevSrcRef = useRef('');
  useEffect(() => {
    const srcKey = `${values.srcChain ?? ''}-${values.srcToken}`;
    if (srcKey === prevSrcRef.current) return;
    prevSrcRef.current = srcKey;
    if (!warpDestinations.length || !values.srcToken) return;
    const firstDst = warpDestinations[0];
    setFieldValue('dstChain', firstDst.chainId);
    setFieldValue('dstToken', firstDst.address);
  }, [values.srcChain, values.srcToken, warpDestinations, setFieldValue]);

  const srcChainInfo = chainsResp?.chains.find((c) => c.id === values.srcChain);
  const universalRouter = srcChainInfo?.universalRouter as Address | undefined;

  const [isReview, setIsReview] = useState(false);
  const { close: closeConfirmationModal, isOpen: isConfirmationModalOpen } = useModal();
  const { isOpen: isRouteModalOpen, open: openRouteModal, close: closeRouteModal } = useModal();
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

  const debouncedAmount = useDebounce(values.amount, 750);

  // True only when both tokens have WarpCore keys AND dst is reachable from src via WarpCore.
  // Checking warpDestinations (not just warpCoreKey) prevents cross-asset pairs like
  // ETH→USDC from being treated as bridge routes simply because both tokens happen to
  // have some bridge capability elsewhere.
  const isDstReachableViaBridge = useMemo(
    () =>
      !!(
        srcToken?.warpCoreKey &&
        dstToken?.warpCoreKey &&
        warpDestinations.some((t) => {
          if (t.chainId !== dstToken.chainId) return false;
          // Native tokens: engine uses 0x000...0000, warpDestinations entries carry the
          // router contract address. Match by (chainId, isNative) instead of address.
          if (dstToken.isNative) return t.isNative;
          return t.address.toLowerCase() === dstToken.address.toLowerCase();
        })
      ),
    [srcToken?.warpCoreKey, dstToken?.warpCoreKey, dstToken?.chainId, dstToken?.address, dstToken?.isNative, warpDestinations],
  );

  const {
    quote,
    isLoading: quoteLoading,
    error: quoteError,
    isExpired,
    isQuoteSettled,
  } = useQuote({
    values: { ...values, amount: debouncedAmount, recipient: effectiveRecipient },
    sender,
    pause: isReview || isDstReachableViaBridge,
  });
  useToastError(quoteError, 'Quote failed');

  useEffect(() => {
    setSelectedRouteIndex(0);
  }, [values.srcChain, values.dstChain, values.srcToken, values.dstToken, debouncedAmount]);

  const routes = quote?.routes ?? [];
  const safeIndex = selectedRouteIndex < routes.length ? selectedRouteIndex : 0;
  const bestRoute = routes[safeIndex] ?? routes[0];

  // Determine execution mode.
  // Bridge has priority when a direct WarpCore route exists (same asset, different chain).
  // Engine is used for cross-asset pairs (e.g. ETH→USDC) or when no bridge route exists.
  const routeMode: RouteMode = useMemo(() => {
    if (isDstReachableViaBridge) return 'bridge';
    if (routes.length > 0) return 'engine';
    return 'none';
  }, [isDstReachableViaBridge, routes.length]);

  const bridgeFee = useBridgeFeeData(srcToken, dstToken, values.amount, effectiveRecipient);

  const isNative = !!srcToken?.isNative;
  const amountAtomic = useMemo(() => {
    const initialStep = bestRoute?.raw.steps[0];
    if (initialStep && 'amountIn' in initialStep) return BigInt(initialStep.amountIn);
    return undefined;
  }, [bestRoute]);

  const amountUsd = useTokenUsdValue(srcToken, values.amount);

  const status = useApprovalStatus({
    chainName: srcChainName,
    token: srcToken?.address as Address | undefined,
    owner: sender,
    spender: universalRouter,
    amount: amountAtomic,
    isNative,
  });

  // ── Bridge approval check ────────────────────────────────────────────
  const bridgeAmountWei = useMemo(() => {
    if (!bridgeFee.originToken || !values.amount || isNative) return undefined;
    try { return toWei(values.amount, bridgeFee.originToken.decimals); } catch { return undefined; }
  }, [bridgeFee.originToken, values.amount, isNative]);
  const { isApproveRequired: isBridgeApproveRequired } = useIsApproveRequired(
    bridgeFee.originToken,
    bridgeAmountWei,
    routeMode === 'bridge' && !!bridgeAmountWei,
  );

  // ── Swap (engine) execution ───────────────────────────────────────────
  const swap = useSwap();
  useToastError(swap.error, 'Swap failed');
  const addSwapTransaction = useStore((s) => s.addSwapTransaction);
  const setSelectedTransactionId = useStore((s) => s.setSelectedTransactionId);
  const setActiveSwapTransactionId = useStore((s) => s.setActiveSwapTransactionId);
  const updateSwapTransactionStatus = useStore((s) => s.updateSwapTransactionStatus);
  const setSwapLoading = useStore((s) => s.setSwapLoading);

  const activeSwap = useStore((s) =>
    s.activeSwapTransactionId != null
      ? s.transactionHistory.find((item) => item.id === s.activeSwapTransactionId)
      : undefined,
  );
  const isActiveSwapInFlight =
    activeSwap?.type === TransactionHistoryItemType.Swap &&
    !FinalSwapStatuses.includes(activeSwap.data.status);

  // ── Bridge (WarpCore) fallback execution ─────────────────────────────
  const setTransferLoading = useStore((s) => s.setTransferLoading);
  const { triggerTransactions } = useTokenTransfer(() => setTransferLoading(false));

  const hasAmount = !!values.amount && Number(values.amount) > 0;
  const hasTokens = !!srcToken && !!dstToken;

  const [isValidating, setIsValidating] = useState(false);
  const latestValuesRef = useRef(values);
  useEffect(() => {
    latestValuesRef.current = values;
  }, [values]);

  // ── Continue (pre-review) validation ─────────────────────────────────
  const onContinue = useCallback(async () => {
    const snapshot = values;
    setIsValidating(true);
    try {
      if (routeMode === 'bridge') {
        // Minimal bridge validation — WarpCore validateTransfer runs at exec time.
        if (!srcToken?.warpCoreKey || !dstToken?.warpCoreKey) {
          setErrors({ form: 'Bridge route not available' } as any);
          return;
        }
        if (!effectiveRecipient) {
          setErrors({ recipient: 'Recipient required' } as any);
          return;
        }
        setErrors({});
        setIsReview(true);
        return;
      }

      // Engine mode validation.
      const approvalPending =
        status.phase === ApprovalPhase.NeedsApprove || status.phase === ApprovalPhase.NeedsRevoke;
      const result = await validateSwapForm({
        values,
        bestRoute,
        srcToken,
        dstToken,
        sender,
        effectiveRecipient,
        chains: chainsResp?.chains,
        multiProvider,
        approvalPending,
        quoteExpiresAt: quote?.expiresAt,
      });
      if (latestValuesRef.current !== snapshot) return;
      if (result) {
        setErrors(result);
        return;
      }
      if (!sender || !srcToken || !dstToken || !bestRoute || !effectiveRecipient) return;
      setErrors({});
      setIsReview(true);
    } finally {
      setIsValidating(false);
    }
  }, [
    values,
    routeMode,
    srcToken,
    dstToken,
    bestRoute,
    sender,
    effectiveRecipient,
    chainsResp?.chains,
    multiProvider,
    status.phase,
    quote?.expiresAt,
    setErrors,
  ]);

  // ── Send ──────────────────────────────────────────────────────────────
  const onSendTransactions = useCallback(async () => {
    if (routeMode === 'bridge') {
      // Use the connected token pair from bridgeFee — it already resolved the correct
      // origin token that has a direct connection to the destination, working around the
      // multi-route deduplication issue where srcToken.warpCoreKey may point to a token
      // that doesn't directly connect to the selected destination.
      const bridgeOrigin = bridgeFee.originToken ?? null;
      const bridgeDstKey = bridgeFee.destinationToken
        ? getWarpTokenKey(bridgeFee.destinationToken)
        : dstToken?.warpCoreKey;
      if (!bridgeDstKey) return;
      setIsReview(false);
      setTransferLoading(true);
      const bridgeValues: TransferFormValues = {
        originTokenKey: bridgeOrigin ? getWarpTokenKey(bridgeOrigin) : srcToken?.warpCoreKey,
        destinationTokenKey: bridgeDstKey,
        amount: values.amount,
        recipient: effectiveRecipient as Address,
      };
      await triggerTransactions(bridgeValues, bridgeOrigin, null);
      return;
    }

    // Engine mode.
    if (!sender || !srcToken || !dstToken || !bestRoute || !values.srcChain || !values.dstChain) {
      return;
    }

    const snapshot = values;
    const approvalPending =
      status.phase === ApprovalPhase.NeedsApprove || status.phase === ApprovalPhase.NeedsRevoke;
    const validationResult = await validateSwapForm({
      values,
      bestRoute,
      srcToken,
      dstToken,
      sender,
      effectiveRecipient,
      chains: chainsResp?.chains,
      multiProvider,
      approvalPending,
      quoteExpiresAt: quote?.expiresAt,
    });
    if (latestValuesRef.current !== snapshot) return;
    if (validationResult) {
      setErrors(validationResult);
      setIsReview(false);
      return;
    }

    setIsReview(false);
    setSwapLoading(true);

    const initialStep = bestRoute.raw.steps[0];
    const finalStep = bestRoute.raw.steps[bestRoute.raw.steps.length - 1];
    const destinationSwapStep = bestRoute.raw.steps.find(
      (step): step is Extract<(typeof bestRoute.raw.steps)[number], { type: 'swap' }> =>
        step.type === 'swap' && step.chain === values.dstChain,
    );
    const timestamp = Date.now();
    const item: SwapHistoryItem = {
      status: SwapStatus.Preparing,
      timestamp,
      srcChain: values.srcChain,
      dstChain: values.dstChain,
      srcToken: srcToken.address,
      dstToken: dstToken.address,
      srcTokenMeta: {
        symbol: srcToken.symbol,
        decimals: srcToken.decimals,
        chainName: srcToken.chainName,
        logoURI: srcToken.logoURI,
      },
      dstTokenMeta: {
        symbol: dstToken.symbol,
        decimals: dstToken.decimals,
        chainName: dstToken.chainName,
        logoURI: dstToken.logoURI,
      },
      amountIn:
        initialStep && 'amountIn' in initialStep ? initialStep.amountIn : bestRoute.raw.output,
      amountOut: finalStep && 'amountOut' in finalStep ? finalStep.amountOut : bestRoute.raw.output,
      sender,
      recipient: effectiveRecipient,
      destinationOutcome:
        bestRoute.raw.callCommitment && destinationSwapStep
          ? {
              bridgeToken: destinationSwapStep.tokenIn,
              dstToken: destinationSwapStep.tokenOut,
            }
          : undefined,
    };
    const transactionId = addSwapTransaction(item);
    setSelectedTransactionId(transactionId);
    setActiveSwapTransactionId(transactionId);

    try {
      await swap.execute({
        transactionId,
        route: bestRoute,
        srcChainId: values.srcChain,
        dstChainId: values.dstChain,
        srcToken: srcToken.address,
        dstToken: dstToken.address,
        sender,
        recipient: effectiveRecipient,
        spender: universalRouter,
        approvalAmount: amountAtomic,
        isNative,
      });
    } catch {
      const cur = useStore
        .getState()
        .transactionHistory.find((historyItem) => historyItem.id === transactionId);
      if (
        cur?.type === TransactionHistoryItemType.Swap &&
        !FinalSwapStatuses.includes(cur.data.status)
      ) {
        updateSwapTransactionStatus(transactionId, SwapStatus.Failed);
      }
    } finally {
      setActiveSwapTransactionId(null);
      setSwapLoading(false);
    }
  }, [
    routeMode,
    srcToken,
    dstToken,
    bestRoute,
    values,
    effectiveRecipient,
    sender,
    status.phase,
    chainsResp?.chains,
    multiProvider,
    quote?.expiresAt,
    universalRouter,
    amountAtomic,
    isNative,
    swap,
    addSwapTransaction,
    setSelectedTransactionId,
    setActiveSwapTransactionId,
    updateSwapTransactionStatus,
    setSwapLoading,
    triggerTransactions,
    setTransferLoading,
    setErrors,
  ]);

  // Clear stale errors when relevant fields change.
  useEffect(() => {
    if (objLength(errors) === 0) return;
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    values.amount,
    values.recipient,
    values.srcChain,
    values.dstChain,
    values.srcToken,
    values.dstToken,
  ]);

  const onFlipTokens = useCallback(() => {
    if (isReview) return;
    setValues((prev) => ({
      ...prev,
      amount: '',
      srcChain: prev.dstChain,
      dstChain: prev.srcChain,
      srcToken: prev.dstToken,
      dstToken: prev.srcToken,
      recipient: '',
    }));
    if (srcToken && dstToken) {
      updateQueryParams({
        [WARP_QUERY_PARAMS.ORIGIN]: dstToken.chainName,
        [WARP_QUERY_PARAMS.ORIGIN_TOKEN]: dstToken.address,
        [WARP_QUERY_PARAMS.DESTINATION]: srcToken.chainName,
        [WARP_QUERY_PARAMS.DESTINATION_TOKEN]: srcToken.address,
      });
    }
  }, [setValues, isReview, srcToken, dstToken]);

  const extraErrors = errors as Partial<Record<'form', string>>;
  const topLevelError =
    extraErrors.form || errors.srcChain || errors.dstChain || errors.srcToken || errors.dstToken;

  const sendPending = routeMode === 'bridge' ? false : isActiveSwapInFlight;

  return (
    <>
      <div className="max-h-12 overflow-hidden sm:max-h-10">
        <WalletConnectionWarning origin={srcChainName || ''} />
        <FormWarningBanner isVisible={isExpired}>Price expired — refreshing…</FormWarningBanner>
        <FormWarningBanner isVisible={!!topLevelError}>{topLevelError}</FormWarningBanner>
      </div>

      <TransferSection label="Send">
        <OriginCard
          isReview={isReview}
          srcChainName={srcChainName}
          srcToken={srcToken}
          amountError={errors.amount}
          counterpartToken={dstToken}
          warpOriginTokens={allWarpTokens}
        />
      </TransferSection>

      <FlipTokensButton onClick={onFlipTokens} disabled={isReview} />

      <TransferSection label="Receive">
        <DestinationCard
          isReview={isReview}
          dstChainName={dstChainName}
          dstToken={dstToken}
          srcToken={srcToken}
          recipient={effectiveRecipient}
          bestRoute={bestRoute}
          quoteLoading={quoteLoading}
          routeMode={routeMode}
          recipientError={errors.recipient}
          inputUsd={amountUsd}
          amount={values.amount}
          warpDestinations={destinationExtraTokens}
        />
      </TransferSection>

      {!isReview && (
        <div className="mt-2 flex items-center justify-between gap-3 px-1">
          {routeMode === 'engine' ? (
            <FeeSectionButton
              feeBreakdown={bestRoute?.feeBreakdown}
              isLoading={quoteLoading}
              inputUsd={amountUsd}
            />
          ) : routeMode === 'bridge' ? (
            <BridgeFeeSectionButton
              fees={bridgeFee.fees}
              isLoading={bridgeFee.isLoading}
              isError={bridgeFee.isError}
              feePrices={bridgeFee.feePrices}
              transferUsd={bridgeFee.transferUsd}
            />
          ) : (
            <div />
          )}

          {routeMode === 'engine' && (
            <div className="flex items-center gap-2">
              {routes.length > 0 && (
                <button
                  type="button"
                  onClick={openRouteModal}
                  className="flex items-center gap-1 rounded font-secondary text-xxs text-gray-700 hover:text-gray-900 dark:text-foreground-secondary dark:hover:text-foreground-primary"
                >
                  <RouteIcon />
                  {routes.length > 1
                    ? `${routes.length} routes`
                    : `Route ${safeIndex + 1}/${routes.length}`}
                </button>
              )}
              <SlippagePanel
                slippageBps={values.slippageBps}
                setSlippageBps={(bps) => setFieldValue('slippageBps', bps)}
              />
            </div>
          )}
        </div>
      )}

      {routeMode === 'engine' && (
        <RouteSelectionModal
          isOpen={isRouteModalOpen}
          close={closeRouteModal}
          routes={routes}
          selectedIndex={safeIndex}
          onSelect={setSelectedRouteIndex}
          dstToken={dstToken}
        />
      )}

      <ReviewSection
        isReview={isReview}
        routeMode={routeMode}
        bestRoute={bestRoute}
        srcToken={srcToken}
        dstToken={dstToken}
        approvalStatus={status.phase}
        universalRouter={universalRouter}
        bridgeAmount={values.amount}
        isBridgeApproveRequired={isBridgeApproveRequired}
      />

      <ButtonSection
        isReview={isReview}
        setIsReview={setIsReview}
        srcChainName={srcChainName ?? ''}
        dstChainName={dstChainName}
        hasAmount={hasAmount}
        hasTokens={hasTokens}
        routeMode={routeMode}
        isQuoteSettled={isQuoteSettled}
        isValidating={isValidating}
        onSendTransactions={onSendTransactions}
        sendPending={sendPending}
      />

      <RecipientConfirmationModal
        isOpen={isConfirmationModalOpen}
        close={closeConfirmationModal}
        onConfirm={() => setIsReview(true)}
        recipient={effectiveRecipient}
        destinationChainDisplay={
          dstChainName ? multiProvider.tryGetChainMetadata(dstChainName)?.displayName : undefined
        }
      />

      <FormSubmitDispatcher onContinue={onContinue} isReview={isReview} />
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OriginCard({
  isReview,
  srcChainName,
  srcToken,
  amountError,
  counterpartToken,
  warpOriginTokens,
}: {
  isReview: boolean;
  srcChainName: string | undefined;
  srcToken: CombinedToken | undefined;
  amountError: string | undefined;
  counterpartToken: CombinedToken | undefined;
  warpOriginTokens: CombinedToken[];
}) {
  const { values } = useFormikContext<SwapFormValues>();
  const { data: balance, isLoading: isBalanceLoading } = useTokenBalance(srcToken);
  const amountUsd = useTokenUsdValue(srcToken, values.amount);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <WalletDropdown chainName={srcChainName} selectionMode="origin" disabled={isReview} />
      </div>
      <div className="transfer-chain-field rounded-[7px] border border-gray-400/25 bg-white p-3 shadow-input dark:border-primary-300/[0.18] dark:bg-transparent dark:shadow-none">
        <MergedTokenSelectField
          selectionMode="origin"
          disabled={isReview}
          selectedToken={srcToken}
          counterpartToken={counterpartToken}
          extraTokens={warpOriginTokens}
        />
        <div className="transfer-divider my-2.5 h-px bg-primary-50 dark:bg-primary-300/[0.22]" />
        <div className="flex items-center justify-between gap-2">
          <TextField
            name="amount"
            placeholder="0"
            type="number"
            step="any"
            min="0"
            disabled={isReview}
            className="transfer-text-input w-full flex-1 border-none bg-transparent font-secondary text-xl font-normal text-gray-900 outline-none placeholder:text-gray-900 dark:text-foreground-primary dark:placeholder:text-foreground-secondary"
            onWheel={(e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur()}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === '-' || e.key === 'e') e.preventDefault();
            }}
          />
          <MaxButton
            balance={balance ?? undefined}
            isLoading={isBalanceLoading}
            disabled={isReview}
            token={srcToken}
          />
        </div>
        <div className="transfer-balance mt-1 flex items-center justify-between text-xs leading-[18px] text-gray-450 dark:text-foreground-secondary">
          <span>{!amountUsd ? '$0.00' : formatUsd(amountUsd)}</span>
          <TokenBalance label="Balance" balance={balance ?? null} token={srcToken} />
        </div>
      </div>
      {amountError && (
        <p className="mt-1 pl-1 text-xs text-red-500 dark:text-red-400">{amountError}</p>
      )}
    </div>
  );
}

function DestinationCard({
  isReview,
  dstChainName,
  dstToken,
  srcToken,
  recipient,
  bestRoute,
  quoteLoading,
  routeMode,
  recipientError,
  inputUsd,
  amount,
  warpDestinations,
}: {
  isReview: boolean;
  dstChainName: string | undefined;
  dstToken: CombinedToken | undefined;
  srcToken: CombinedToken | undefined;
  recipient: string;
  bestRoute: AugmentedRoute | undefined;
  quoteLoading: boolean;
  routeMode: RouteMode;
  recipientError: string | undefined;
  inputUsd: number | null;
  amount: string;
  warpDestinations: CombinedToken[];
}) {
  const { values, setFieldValue } = useFormikContext<SwapFormValues>();
  const { data: balance } = useTokenBalance(dstToken, recipient);

  const outputDisplay = useMemo(() => {
    if (routeMode === 'bridge') {
      return amount && Number(amount) > 0 ? amount : '';
    }
    if (!bestRoute || !dstToken) return '';
    try {
      return formatDisplayAmount(BigInt(bestRoute.raw.output), dstToken.decimals);
    } catch {
      return '';
    }
  }, [routeMode, amount, bestRoute, dstToken]);

  const outputExact = useMemo(() => {
    if (!bestRoute || !dstToken) return '';
    try {
      return formatUnits(BigInt(bestRoute.raw.output), dstToken.decimals);
    } catch {
      return '';
    }
  }, [bestRoute, dstToken]);

  const outputUsd = useTokenUsdValue(dstToken, outputExact);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <WalletDropdown
          chainName={dstChainName}
          selectionMode="destination"
          recipient={values.recipient}
          onRecipientChange={(addr) => setFieldValue('recipient', addr)}
          disabled={isReview}
        />
      </div>
      <div className="transfer-chain-field rounded-[7px] border border-gray-400/25 bg-white p-3 shadow-input dark:border-primary-300/[0.18] dark:bg-transparent dark:shadow-none">
        <MergedTokenSelectField
          selectionMode="destination"
          disabled={isReview}
          selectedToken={dstToken}
          counterpartToken={srcToken}
          extraTokens={warpDestinations}
        />
        <div className="transfer-divider my-2.5 h-px bg-primary-50 dark:bg-primary-300/[0.22]" />
        <div className="flex items-center justify-between gap-2">
          <input
            type="text"
            readOnly
            placeholder={quoteLoading ? '…' : '0'}
            value={outputDisplay}
            className="transfer-text-output w-full flex-1 cursor-not-allowed border-none bg-transparent font-secondary text-xl font-normal text-gray-900 outline-none placeholder:text-gray-400 dark:text-foreground-primary dark:placeholder:text-foreground-secondary"
            tabIndex={-1}
            aria-label="Expected output amount"
          />
        </div>
        <div className="transfer-balance mt-1 flex items-center justify-between text-xs leading-[18px] text-gray-450 dark:text-foreground-secondary">
          <span>{!outputUsd ? '$0.00' : formatUsd(outputUsd)}</span>
          <TokenBalance label="Remote Balance" balance={balance ?? null} token={dstToken} />
        </div>
      </div>
      {recipientError && (
        <p className="mt-1 pl-1 text-xs text-red-500 dark:text-red-400">{recipientError}</p>
      )}
    </div>
  );
}

function FlipTokensButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <div className="relative z-10 -my-3 flex justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="swap-chains-button group flex h-8 w-8 items-center justify-center rounded border border-gray-400/50 bg-white shadow-button transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-primary-300/35 dark:bg-background/90 dark:shadow-none dark:hover:bg-primary-300/[0.18]"
      >
        <SwapIcon
          width={18}
          height={24}
          className="swap-chains-icon transition-transform duration-300 group-hover:rotate-180 group-disabled:rotate-0 dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.55)] dark:[&_path]:fill-white"
        />
      </button>
    </div>
  );
}


function ReviewSection({
  isReview,
  routeMode,
  bestRoute,
  srcToken,
  dstToken,
  approvalStatus,
  universalRouter,
  bridgeAmount,
  isBridgeApproveRequired,
}: {
  isReview: boolean;
  routeMode: RouteMode;
  bestRoute: AugmentedRoute | undefined;
  srcToken: CombinedToken | undefined;
  dstToken: CombinedToken | undefined;
  approvalStatus: ApprovalPhase;
  universalRouter: Address | undefined;
  bridgeAmount: string;
  isBridgeApproveRequired: boolean;
}) {
  const multiProvider = useMultiProvider();
  const engineTokenMap = useEngineTokenByKeyMap();

  return (
    <div
      className={`${
        isReview ? 'max-h-screen duration-1000 ease-in' : 'max-h-0 duration-500'
      } overflow-hidden transition-all`}
    >
      <label className="transfer-field-label mt-4 block pl-0.5 text-sm text-gray-600 dark:text-foreground-secondary">
        Transactions
      </label>
      <div className="transfer-review-panel mt-1.5 space-y-2 break-all rounded border border-gray-400 bg-gray-150 px-2.5 py-2 text-sm dark:border-primary-300/25 dark:bg-background/40 dark:text-foreground-primary">
        {routeMode === 'bridge' ? (
          <BridgeReviewTransactions
            srcToken={srcToken}
            dstToken={dstToken}
            amount={bridgeAmount}
            isApproveRequired={isBridgeApproveRequired}
          />
        ) : bestRoute ? (
          <EngineReviewTransactions
            route={bestRoute}
            srcToken={srcToken}
            dstToken={dstToken}
            approvalStatus={approvalStatus}
            universalRouter={universalRouter}
            tokenMap={engineTokenMap}
            multiProvider={multiProvider}
          />
        ) : (
          <p className="text-xs text-gray-500">No route to review.</p>
        )}
      </div>
    </div>
  );
}

function BridgeReviewTransactions({
  srcToken,
  dstToken,
  amount,
  isApproveRequired,
}: {
  srcToken: CombinedToken | undefined;
  dstToken: CombinedToken | undefined;
  amount: string;
  isApproveRequired: boolean;
}) {
  const txNum = isApproveRequired ? 2 : 1;
  return (
    <div className="space-y-2">
      {isApproveRequired && (
        <div>
          <h4>Transaction 1: Approve Transfer</h4>
          <div className="ml-1.5 mt-1.5 space-y-1.5 border-l border-gray-300 pl-2 text-xs dark:border-primary-300/25">
            <p className="flex">
              <span className="min-w-[7.5rem]">Action</span>
              <span>Approve {srcToken?.symbol} for transfer</span>
            </p>
            <p className="flex">
              <span className="min-w-[7.5rem]">Amount</span>
              <span>{amount} {srcToken?.symbol ?? ''}</span>
            </p>
          </div>
        </div>
      )}
      <div>
        <h4>Transaction {txNum}: Bridge via Warp Route</h4>
        <div className="ml-1.5 mt-1.5 space-y-1.5 border-l border-gray-300 pl-2 text-xs dark:border-primary-300/25">
          {dstToken?.addressOrDenom && (
            <p className="flex">
              <span className="min-w-[7.5rem]">Remote Token</span>
              <span>{dstToken.addressOrDenom}</span>
            </p>
          )}
          <p className="flex">
            <span className="min-w-[7.5rem]">Amount</span>
            <span>{amount} {srcToken?.symbol ?? ''}</span>
          </p>
          <p className="flex">
            <span className="min-w-[7.5rem]">Receive</span>
            <span>{amount} {dstToken?.symbol ?? ''}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function EngineReviewTransactions({
  route,
  srcToken,
  dstToken,
  approvalStatus,
  universalRouter,
  tokenMap,
  multiProvider,
}: {
  route: AugmentedRoute;
  srcToken: CombinedToken | undefined;
  dstToken: CombinedToken | undefined;
  approvalStatus: ApprovalPhase;
  universalRouter: Address | undefined;
  tokenMap: Map<string, CombinedToken>;
  multiProvider: ReturnType<typeof useMultiProvider>;
}) {
  const needsRevoke = approvalStatus === ApprovalPhase.NeedsRevoke;
  const needsApprove =
    approvalStatus === ApprovalPhase.NeedsApprove || approvalStatus === ApprovalPhase.NeedsRevoke;
  const symbol = srcToken?.symbol ?? 'token';
  const dstDecimals = dstToken?.decimals ?? 18;
  const dstSymbol = dstToken?.symbol ?? '';

  let txNum = 0;
  return (
    <>
      {needsRevoke && (
        <div>
          <h4>{`Transaction ${++txNum}: Revoke ${symbol}`}</h4>
          <div className="ml-1.5 mt-1.5 space-y-1.5 border-l border-gray-300 pl-2 text-xs dark:border-primary-300/25">
            <p>{`Token: ${srcToken?.address}`}</p>
            <p>{`Spender (UR): ${universalRouter ?? '—'}`}</p>
            <p>Reset existing allowance to 0 before re-approving (USDT-style).</p>
          </div>
        </div>
      )}
      {needsApprove && (
        <div>
          <h4>{`Transaction ${++txNum}: Approve ${symbol} → Universal Router`}</h4>
          <div className="ml-1.5 mt-1.5 space-y-1.5 border-l border-gray-300 pl-2 text-xs dark:border-primary-300/25">
            <p>{`Token: ${srcToken?.address}`}</p>
            <p>{`Spender (UR): ${universalRouter ?? '—'}`}</p>
          </div>
        </div>
      )}
      <div>
        <h4>{`Transaction ${++txNum}: ${route.isBridgeOnly ? 'Bridge' : 'Swap'}`}</h4>
        <div className="ml-1.5 mt-1.5 space-y-1.5 border-l border-gray-300 pl-2 text-xs dark:border-primary-300/25">
          {dstToken?.address && (
            <p className="flex">
              <span className="min-w-[7.5rem]">Output Token</span>
              <span>{dstToken.address}</span>
            </p>
          )}
          <p className="flex">
            <span className="min-w-[7.5rem]">Expected Output</span>
            <span>{`${formatDisplayAmount(BigInt(route.raw.output), dstDecimals)} ${dstSymbol}`}</span>
          </p>
          {!route.isBridgeOnly && (
            <p className="flex">
              <span className="min-w-[7.5rem]">Min Output</span>
              <span>{`${formatDisplayAmount(BigInt(route.raw.outputMin), dstDecimals)} ${dstSymbol}`}</span>
            </p>
          )}
          {route.feeBreakdown.components
            .filter((c) => c.amount > 0n)
            .map((c, i) => {
              const label = c.category === 'bridge' ? 'Bridge Fee' : 'Interchain Gas';
              const isNative = /^0x0+$/i.test(c.tokenAddress);
              const componentChainName =
                multiProvider.tryGetChainName(c.chainId) ?? `chain-${c.chainId}`;
              const nativeMeta = isNative
                ? multiProvider.tryGetChainMetadata(componentChainName)?.nativeToken
                : undefined;
              const componentToken = isNative
                ? undefined
                : tokenMap.get(`${c.chainId}-${c.tokenAddress.toLowerCase()}`);
              const decimals = isNative ? (nativeMeta?.decimals ?? 18) : (componentToken?.decimals ?? 18);
              const sym = isNative ? (nativeMeta?.symbol ?? 'ETH') : (componentToken?.symbol ?? '???');
              return (
                <p key={`${c.category}-${c.chainId}-${c.tokenAddress}-${i}`} className="flex">
                  <span className="min-w-[7.5rem]">{label}</span>
                  <span>{`${formatDisplayAmount(c.amount, decimals)} ${sym}`}</span>
                </p>
              );
            })}
        </div>
      </div>
    </>
  );
}

function ButtonSection({
  isReview,
  setIsReview,
  srcChainName,
  dstChainName,
  hasAmount,
  hasTokens,
  routeMode,
  isQuoteSettled,
  isValidating,
  onSendTransactions,
  sendPending,
}: {
  isReview: boolean;
  setIsReview: (b: boolean) => void;
  srcChainName: string;
  dstChainName: string | undefined;
  hasAmount: boolean;
  hasTokens: boolean;
  routeMode: RouteMode;
  isQuoteSettled: boolean;
  isValidating: boolean;
  onSendTransactions: () => Promise<void>;
  sendPending: boolean;
}) {
  const multiProvider = useMultiProvider();
  const dstMetadata = dstChainName ? multiProvider.tryGetChainMetadata(dstChainName) : undefined;
  const dstDisplay = dstMetadata?.displayName || dstMetadata?.name || dstChainName || 'destination';

  let text = 'Continue';
  let disabled = false;
  if (!hasTokens) {
    text = 'Select tokens';
    disabled = true;
  } else if (!hasAmount) {
    text = 'Enter amount';
    disabled = true;
  } else if (routeMode === 'bridge') {
    text = isValidating ? 'Checking…' : 'Continue';
    disabled = isValidating;
  } else if (routeMode === 'engine') {
    text = isValidating ? 'Checking…' : 'Continue';
    disabled = isValidating;
  } else if (isQuoteSettled) {
    text = 'Route is not supported';
    disabled = true;
  } else {
    text = 'Fetching quote…';
    disabled = true;
  }

  if (!isReview) {
    return (
      <ConnectAwareSubmitButton
        chainName={srcChainName}
        text={text}
        disabled={disabled}
        classes="w-full mb-4 px-3 py-2.5 font-secondary text-xl text-cream-100"
      />
    );
  }

  return (
    <div className="mb-4 mt-4 flex items-center justify-between space-x-4">
      <SolidButton
        type="button"
        color="primary"
        onClick={() => setIsReview(false)}
        className="px-6 py-1.5 font-secondary"
      >
        <span>Edit</span>
      </SolidButton>
      <SolidButton
        type="button"
        color="accent"
        onClick={onSendTransactions}
        disabled={sendPending}
        className="flex-1 px-3 py-1.5 font-secondary text-white"
      >
        {sendPending ? 'Sending…' : `Send to ${dstDisplay}`}
      </SolidButton>
    </div>
  );
}

function FormSubmitDispatcher({
  onContinue,
  isReview,
}: {
  onContinue: () => void;
  isReview: boolean;
}) {
  const { submitCount } = useFormikContext<SwapFormValues>();
  useEffect(() => {
    if (submitCount === 0 || isReview) return;
    onContinue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitCount]);
  return null;
}
