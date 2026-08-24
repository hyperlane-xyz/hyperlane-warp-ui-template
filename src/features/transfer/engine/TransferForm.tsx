import { eqAddress, isValidAddressEvm, objLength, ProtocolType } from '@hyperlane-xyz/utils';
import { useDebounce, useModal } from '@hyperlane-xyz/widgets';
import {
  getAccountAddressAndPubKey,
  getAccountAddressForChain,
  useAccounts,
} from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { useAccount as useStarknetAccount, type UseAccountResult } from '@starknet-react/core';
import { useQuery } from '@tanstack/react-query';
import { Form, Formik, useFormikContext } from 'formik';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatUnits, type Address } from 'viem';

import { FormWarningBanner } from '../../../components/banner/FormWarningBanner';
import { RecipientWarningBanner } from '../../../components/banner/RecipientWarningBanner';
import { ConnectAwareSubmitButton } from '../../../components/buttons/ConnectAwareSubmitButton';
import { SolidButton } from '../../../components/buttons/SolidButton';
import { RouteIcon } from '../../../components/icons/RouteIcon';
import { SwapIcon } from '../../../components/icons/SwapIcon';
import { TextField } from '../../../components/input/TextField';
import { TransferSection } from '../../../components/layout/TransferSection';
import { useToastError } from '../../../components/toast/useToastError';
import { WARP_QUERY_PARAMS } from '../../../consts/args';
import { config } from '../../../consts/config';
import { logger } from '../../../utils/logger';
import { updateQueryParams } from '../../../utils/queryParams';
import { trackTransferValidationFailed, trackUnsupportedRouteEvent } from '../../analytics/utils';
import { useChains } from '../../api/hooks';
import type { RouteTx } from '../../api/types';
import { useTokenBalance } from '../../balances/hooks';
import { readBalance } from '../../balances/read';
import { formatDisplayAmount, formatFeeAmount, formatUsd } from '../../balances/utils';
import { useMultiProvider } from '../../chains/hooks';
import { TransactionHistoryItemType, useStore } from '../../store';
import { getTokenByKeyFromMap, useTokenByKeyMap } from '../../tokens/hooks';
import { TokenSelectField } from '../../tokens/TokenSelectField';
import type { UiToken } from '../../tokens/types';
import { useTokenPrices, useTokenUsdValue } from '../../tokens/useTokenPrice';
import { tokenKey } from '../../tokens/utils';
import { RecipientConfirmationModal } from '../../wallet/RecipientConfirmationModal';
import { WalletConnectionWarning } from '../../wallet/WalletConnectionWarning';
import { WalletDropdown } from '../../wallet/WalletDropdown';
import {
  ApprovalPhase,
  type ApprovalPlan,
  getApprovalPlanTransactionCount,
  getApprovalTransactionCount,
  isApprovalReadyForValidation,
  readApprovalPlan,
  useApprovalStatus,
} from './approval';
import { FeeSectionButton } from './FeeSectionButton';
import { MaxButton } from './MaxButton';
import { RouteSelectionModal } from './routeSelection/RouteSelectionModal';
import { SlippagePanel } from './SlippagePanel';
import { estimateRouteSourceFee, sourceFeeRouteKey, withEstimatedSourceFee } from './sourceFee';
import { TokenBalance } from './TokenBalance';
import {
  FinalTransferStatuses,
  TransferStatus,
  type AugmentedRoute,
  type TransferFormValues,
  type TransferHistoryItem,
} from './types';
import { useFormInitialValues } from './useFormInitialValues';
import { useQuote } from './useQuote';
import { useTransfer } from './useTransfer';
import { validateTransferForm } from './validate';

const PRICE_IMPACT_DANGER_PCT = -3;
const PRICE_IMPACT_WARN_PCT = -1;
const PCT_FORMAT_OPTIONS = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function TransferForm() {
  const initialValues = useFormInitialValues();
  return (
    <Formik<TransferFormValues>
      initialValues={initialValues}
      enableReinitialize
      onSubmit={() => undefined}
      validateOnChange={false}
      validateOnBlur={false}
    >
      <Form className="transfer-form flex w-full flex-col items-stretch gap-1.5">
        <TransferFormContent />
      </Form>
    </Formik>
  );
}

function TransferFormContent() {
  const { values, errors, setErrors, setFieldValue, setValues } =
    useFormikContext<TransferFormValues>();
  const hasSelectedDestinationTokenRef = useRef(false);
  const multiProvider = useMultiProvider();
  const tokenMap = useTokenByKeyMap();
  const { data: chainsResp } = useChains();
  const { account: starknetAccount } = useStarknetAccount();
  // Mounts the catalogue-wide price fetch once for the whole form. Cards
  // and review modal read individual prices via `useTokenUsdValue` (pure
  // store readers); without this top-level call, deep-linked URLs would
  // render cards before the picker opens and see empty USD values.
  useTokenPrices();

  const srcChainName =
    values.srcChain != null
      ? (multiProvider.tryGetChainName(values.srcChain) ?? undefined)
      : undefined;
  const dstChainName =
    values.dstChain != null
      ? (multiProvider.tryGetChainName(values.dstChain) ?? undefined)
      : undefined;
  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);
  const { address: sender, publicKey: senderPubKey } = getAccountAddressAndPubKey(
    multiProvider,
    srcChainName,
    accounts,
  );
  const connectedDestAddress = getAccountAddressForChain(multiProvider, dstChainName, accounts);
  const effectiveRecipient = values.recipient || connectedDestAddress || '';

  const srcTokenKey =
    values.srcChain != null && values.srcToken
      ? tokenKey(values.srcChain, values.srcToken)
      : undefined;
  const dstTokenKey =
    values.dstChain != null && values.dstToken
      ? tokenKey(values.dstChain, values.dstToken)
      : undefined;
  const srcToken = getTokenByKeyFromMap(tokenMap, srcTokenKey);
  const dstToken = getTokenByKeyFromMap(tokenMap, dstTokenKey);

  const [isReview, setIsReview] = useState(false);
  const {
    open: openConfirmationModal,
    close: closeConfirmationModal,
    isOpen: isConfirmationModalOpen,
  } = useModal();
  const { isOpen: isRouteModalOpen, open: openRouteModal, close: closeRouteModal } = useModal();
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

  const debouncedAmount = useDebounce(values.amount, 750);
  const latestValuesRef = useRef(values);
  latestValuesRef.current = values;
  const {
    quote,
    data: quoteResponse,
    isLoading: quoteLoading,
    error: quoteError,
    isExpired,
    isQuoteSettled,
    isRouteDataUnavailable,
    requestMaxQuote,
    canRequestMaxQuote,
    isMaxQuoteLoading,
    maxQuoteError,
    maxQuoteUnavailableReason,
    sourceTokenDecimals,
  } = useQuote({
    values: { ...values, amount: debouncedAmount, recipient: effectiveRecipient },
    sender,
    senderPubKey,
    pause: isReview,
  });
  const isAmountDebouncing = values.amount !== debouncedAmount;
  useToastError(quoteError, 'Quote failed');
  useToastError(maxQuoteError, 'Max quote failed');

  // Reset to best route when the user changes intent, not on every background refetch.
  useEffect(() => {
    setSelectedRouteIndex(0);
  }, [values.srcChain, values.dstChain, values.srcToken, values.dstToken, debouncedAmount]);

  const routes = quote?.routes ?? [];
  const safeIndex = selectedRouteIndex < routes.length ? selectedRouteIndex : 0;
  const bestRoute = routes[safeIndex] ?? routes[0];
  const approval = bestRoute?.raw.approval ?? null;
  const srcChainInfo = chainsResp?.chains.find((chain) => chain.id === values.srcChain);
  const dstChainInfo = chainsResp?.chains.find((chain) => chain.id === values.dstChain);

  const approvalAmount = useMemo(
    () => (approval ? BigInt(approval.amount) : undefined),
    [approval],
  );

  // Input USD — used by the fee % calculation in FeeSectionButton.
  const amountUsd = useTokenUsdValue(srcToken, values.amount);

  const approvalArgs = useMemo(
    () => ({
      chainName: srcChainName,
      token: approval?.token as Address | undefined,
      owner: sender,
      spender: approval?.spender as Address | undefined,
      amount: approvalAmount,
      isNative: !approval,
    }),
    [approval, approvalAmount, sender, srcChainName],
  );
  const status = useApprovalStatus(approvalArgs);
  const approvalTransactionCount = getApprovalTransactionCount(status);
  const isApprovalReady = isApprovalReadyForValidation(status, !!approval);
  const sourceFeeKey = bestRoute ? sourceFeeRouteKey(bestRoute.raw) : null;
  const sourceFeeQuery = useQuery({
    queryKey: [
      'router',
      'source-fee',
      srcChainName ?? null,
      sender ?? null,
      sourceFeeKey,
      approvalTransactionCount,
    ],
    queryFn: () => {
      if (!bestRoute || !srcChainName || !sender) {
        throw new Error('Source fee estimate is not ready');
      }
      return estimateRouteSourceFee({
        multiProvider,
        chainName: srcChainName,
        sender,
        senderPubKey,
        route: bestRoute.raw,
        approvalTransactionCount,
      });
    },
    enabled: !!bestRoute && !!srcChainName && !!sender && isApprovalReady && !isReview,
    staleTime: 10_000,
    refetchInterval: 10_000,
    retry: 1,
  });
  useToastError(sourceFeeQuery.error, 'Network fee estimate failed');
  const displayedBestRoute = useMemo(
    () =>
      bestRoute
        ? {
            ...bestRoute,
            feeBreakdown: withEstimatedSourceFee(
              bestRoute.feeBreakdown,
              sourceFeeQuery.data,
              bestRoute.raw.steps[0]?.chain ?? values.srcChain ?? undefined,
            ),
          }
        : undefined,
    [bestRoute, sourceFeeQuery.data, values.srcChain],
  );
  const isSourceFeeReady = !bestRoute || !sourceFeeQuery.isPending;

  const transfer = useTransfer();
  useToastError(transfer.error, 'Transfer failed');
  const addTransferTransaction = useStore((s) => s.addTransferTransaction);
  const setSelectedTransactionId = useStore((s) => s.setSelectedTransactionId);
  const setActiveTransferTransactionId = useStore((s) => s.setActiveTransferTransactionId);
  const updateTransferTransactionStatus = useStore((s) => s.updateTransferTransactionStatus);
  const setTransferLoading = useStore((s) => s.setTransferLoading);

  // Send-button gating tracks the active execution, not the transaction selected
  // for history/modals. Viewing an old pending transfer should not disable the form.
  const activeTransfer = useStore((s) =>
    s.activeTransferTransactionId != null
      ? s.transactionHistory.find((item) => item.id === s.activeTransferTransactionId)
      : undefined,
  );
  const isActiveTransferInFlight =
    activeTransfer?.type === TransactionHistoryItemType.Transfer &&
    !FinalTransferStatuses.includes(activeTransfer.data.status);

  const hasAmount = !!values.amount && Number(values.amount) > 0;
  const hasTokens = !!srcToken && !!dstToken;

  const [isValidating, setIsValidating] = useState(false);
  const trackedUnsupportedRoutesRef = useRef<Set<string>>(new Set());
  const [{ addressConfirmed, showRecipientWarning }, setRecipientInfos] = useState({
    addressConfirmed: true,
    showRecipientWarning: false,
  });

  useEffect(() => {
    if (
      !hasAmount ||
      !srcToken ||
      !dstToken ||
      !quoteResponse ||
      quoteResponse.routes.length > 0 ||
      !isQuoteSettled ||
      isRouteDataUnavailable
    ) {
      return;
    }
    const key = `${srcTokenKey ?? ''}->${dstTokenKey ?? ''}`;
    if (trackedUnsupportedRoutesRef.current.has(key)) return;
    trackedUnsupportedRoutesRef.current.add(key);
    trackUnsupportedRouteEvent(srcToken, dstToken);
  }, [
    dstToken,
    dstTokenKey,
    hasAmount,
    isQuoteSettled,
    isRouteDataUnavailable,
    quoteResponse,
    srcToken,
    srcTokenKey,
  ]);

  // Validate is async; the user can keep editing while it runs. We
  // capture the values reference at request start and bail on resolve
  // if the latest Formik values have changed — otherwise we'd flip into
  // review mode on a form the user has already mutated.
  const maxRequestKey = JSON.stringify([
    values.srcChain,
    values.dstChain,
    values.srcToken,
    values.dstToken,
    values.amount,
    values.slippageBps,
    sender,
    effectiveRecipient,
  ]);
  const latestMaxRequestKeyRef = useRef(maxRequestKey);
  useEffect(() => {
    latestMaxRequestKeyRef.current = maxRequestKey;
  }, [maxRequestKey]);

  const onMax = useCallback(async () => {
    if (!srcToken || sourceTokenDecimals == null) return;
    const requestKey = latestMaxRequestKeyRef.current;
    try {
      const response = await requestMaxQuote();
      if (latestMaxRequestKeyRef.current !== requestKey) return;
      await setFieldValue(
        'amount',
        formatUnits(BigInt(response.amount), sourceTokenDecimals),
        false,
      );
    } catch {
      // useToastError renders the mutation error.
    }
  }, [requestMaxQuote, setFieldValue, sourceTokenDecimals, srcToken]);

  const validateCurrentForm = useCallback(
    async (
      approvalCount = approvalTransactionCount,
      prefetchedSourceFee: bigint | undefined = undefined,
    ) => {
      let sourceFee = prefetchedSourceFee ?? 0n;
      if (prefetchedSourceFee == null && bestRoute && srcChainName && sender) {
        try {
          sourceFee = await estimateRouteSourceFee({
            multiProvider,
            chainName: srcChainName,
            sender,
            senderPubKey,
            route: bestRoute.raw,
            approvalTransactionCount: approvalCount,
          });
        } catch (err) {
          logger.warn('Unable to estimate source transaction fee', err as Error);
          return {
            form: 'Could not estimate the network fee for this transfer. Please try again.',
          };
        }
      }

      const nativeExecutionFee = await estimateStarknetExecutionFee({
        route: bestRoute,
        srcProtocol: srcChainInfo?.protocol,
        account: starknetAccount,
      });
      return validateTransferForm({
        values,
        bestRoute,
        srcToken,
        dstToken,
        sender,
        effectiveRecipient,
        chains: chainsResp?.chains,
        multiProvider,
        quoteExpiresAt: quote?.expiresAt,
        sourceFee,
        nativeExecutionFee,
      });
    },
    [
      approvalTransactionCount,
      bestRoute,
      chainsResp?.chains,
      dstToken,
      effectiveRecipient,
      multiProvider,
      quote?.expiresAt,
      sender,
      senderPubKey,
      srcChainInfo?.protocol,
      srcChainName,
      srcToken,
      starknetAccount,
      values,
    ],
  );

  const onContinue = useCallback(async () => {
    if (isAmountDebouncing || !isApprovalReady || !isSourceFeeReady) return;
    const snapshot = values;
    setIsValidating(true);
    try {
      const result = await validateCurrentForm(approvalTransactionCount, sourceFeeQuery.data);
      // Discard the result if the user edited the form while we were
      // validating — otherwise we'd enter review mode on stale data.
      if (latestValuesRef.current !== snapshot) return;
      if (result) {
        trackTransferValidationFailed({
          errors: result,
          values,
          srcToken,
          dstToken,
          sender,
          recipient: effectiveRecipient,
        });
        setErrors(result);
        return;
      }
      if (!sender || !srcToken || !dstToken || !bestRoute || !effectiveRecipient) return;
      const canReview = await shouldReviewRecipient({
        multiProvider,
        dstChainName,
        recipient: effectiveRecipient,
      });
      if (latestValuesRef.current !== snapshot) return;
      if (!canReview) {
        setErrors({});
        openConfirmationModal();
        return;
      }
      setErrors({});
      setIsReview(true);
    } catch (err) {
      logger.error('onContinue threw unexpectedly', err as Error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setErrors({
        form: err instanceof Error ? err.message : 'Unexpected error — check console',
      } as any);
    } finally {
      setIsValidating(false);
    }
  }, [
    values,
    bestRoute,
    srcToken,
    dstToken,
    sender,
    effectiveRecipient,
    multiProvider,
    isAmountDebouncing,
    isApprovalReady,
    isSourceFeeReady,
    approvalTransactionCount,
    sourceFeeQuery.data,
    validateCurrentForm,
    dstChainName,
    openConfirmationModal,
    setErrors,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function checkSameEvmRecipient() {
      if (!sender || !srcChainName || !dstChainName || !effectiveRecipient) {
        setRecipientInfos({ addressConfirmed: true, showRecipientWarning: false });
        return;
      }

      const sourceProtocol = multiProvider.tryGetProtocol(srcChainName);
      const destinationProtocol = multiProvider.tryGetProtocol(dstChainName);
      if (
        sourceProtocol !== ProtocolType.Ethereum ||
        destinationProtocol !== ProtocolType.Ethereum ||
        !isValidAddressEvm(effectiveRecipient)
      ) {
        setRecipientInfos({ addressConfirmed: true, showRecipientWarning: false });
        return;
      }

      const [senderCheck, recipientCheck] = await Promise.all([
        isSmartContract(multiProvider, srcChainName, sender),
        isSmartContract(multiProvider, dstChainName, effectiveRecipient),
      ]);
      if (!isMounted) return;

      if (senderCheck.error || recipientCheck.error) {
        logger.warn(senderCheck.error || recipientCheck.error);
        setRecipientInfos({ addressConfirmed: true, showRecipientWarning: false });
        return;
      }

      const shouldWarn =
        eqAddress(sender, effectiveRecipient) &&
        senderCheck.isContract &&
        !recipientCheck.isContract;
      setRecipientInfos({
        addressConfirmed: !shouldWarn,
        showRecipientWarning: shouldWarn,
      });
    }

    checkSameEvmRecipient();
    return () => {
      isMounted = false;
    };
  }, [sender, srcChainName, dstChainName, effectiveRecipient, multiProvider]);

  const onSendTransactions = useCallback(async () => {
    if (!sender || !srcToken || !dstToken || !bestRoute || !values.srcChain || !values.dstChain) {
      return;
    }

    // Re-validate before broadcasting. Review mode pauses useQuote, so a
    // user can sit on review past expiresAt with a stale quote — without
    // this check we'd happily submit it. Same call as Continue plus the
    // current quote.expiresAt so the staleness check fires.
    const snapshot = values;
    let executionApprovalPlan: ApprovalPlan | null;
    try {
      executionApprovalPlan = await readApprovalPlan(approvalArgs, multiProvider);
    } catch (err) {
      logger.warn('Unable to verify token approval before transfer', err as Error);
      const validationResult = {
        form: 'Could not verify token approval. Please try again.',
      };
      trackTransferValidationFailed({
        errors: validationResult,
        values,
        srcToken,
        dstToken,
        sender,
        recipient: effectiveRecipient,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setErrors(validationResult as any);
      setIsReview(false);
      return;
    }
    const validationResult = await validateCurrentForm(
      getApprovalPlanTransactionCount(executionApprovalPlan),
    );
    // Same race as onContinue — if the form changed mid-validation,
    // discard the result. In practice the inputs are disabled in review
    // mode, but the wallet dropdown can still change the recipient.
    if (latestValuesRef.current !== snapshot) return;
    if (validationResult) {
      trackTransferValidationFailed({
        errors: validationResult,
        values,
        srcToken,
        dstToken,
        sender,
        recipient: effectiveRecipient,
      });
      // Bail back to edit mode so the user sees the error and the form
      // unpauses useQuote to refresh.
      setErrors(validationResult);
      setIsReview(false);
      return;
    }

    // Drop review immediately so the form stays editable while the
    // broadcast chain runs. Modal carries the live status.
    setIsReview(false);
    setTransferLoading(true);

    const initialStep = bestRoute.raw.steps[0];
    const finalStep = bestRoute.raw.steps[bestRoute.raw.steps.length - 1];
    const destinationSwapStep = bestRoute.raw.steps.find(
      (step): step is Extract<(typeof bestRoute.raw.steps)[number], { type: 'swap' }> =>
        step.type === 'swap' && step.chain === values.dstChain,
    );
    const timestamp = Date.now();
    const item: TransferHistoryItem = {
      status: TransferStatus.Preparing,
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
      // revealAccounts[0] is always the pending_swap PDA per CCS engine spec
      solanaDestSwapPda: bestRoute.raw.callCommitment?.ccs.body.revealAccounts?.[0]?.pubkey,
      destinationOutcome:
        bestRoute.raw.callCommitment && destinationSwapStep
          ? {
              bridgeToken: destinationSwapStep.tokenIn,
              dstToken: destinationSwapStep.tokenOut,
              dstIsNative: dstToken.isNative,
            }
          : undefined,
    };
    const transactionId = addTransferTransaction(item);
    setSelectedTransactionId(transactionId);
    setActiveTransferTransactionId(transactionId);

    try {
      // useTransfer.execute handles revoke / approve / transfer sequencing
      // internally based on the params below.
      await transfer.execute({
        transactionId,
        route: bestRoute,
        srcChainId: values.srcChain,
        dstChainId: values.dstChain,
        srcToken: srcToken.address,
        dstToken: dstToken.address,
        amount: values.amount,
        srcTokenSymbol: srcToken.symbol,
        dstTokenSymbol: dstToken.symbol,
        sender,
        recipient: effectiveRecipient,
        approvalToken: approval?.token,
        spender: approval?.spender as Address | undefined,
        approvalAmount,
        isNative: !approval,
        approvalPlan: executionApprovalPlan,
      });
    } catch {
      // Read latest Zustand state after execute's async failure handling.
      // This catch is only a final safety net and must not downgrade a
      // transfer that already reached a final status.
      const cur = useStore
        .getState()
        .transactionHistory.find((historyItem) => historyItem.id === transactionId);
      if (
        cur?.type === TransactionHistoryItemType.Transfer &&
        !FinalTransferStatuses.includes(cur.data.status)
      ) {
        updateTransferTransactionStatus(transactionId, TransferStatus.Failed);
      }
    } finally {
      setActiveTransferTransactionId(null);
      setTransferLoading(false);
    }
  }, [
    sender,
    srcToken,
    dstToken,
    bestRoute,
    values,
    effectiveRecipient,
    validateCurrentForm,
    approvalArgs,
    multiProvider,
    approval,
    approvalAmount,
    transfer,
    addTransferTransaction,
    setSelectedTransactionId,
    setActiveTransferTransactionId,
    updateTransferTransactionStatus,
    setTransferLoading,
    setErrors,
  ]);

  // Validation runs on Continue, not on change. Clear stale errors when
  // user edits a relevant field.
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
    // Mirror the flip in the URL so refresh keeps the same pair.
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

  return (
    <>
      <WarningBanners
        srcChainName={srcChainName}
        isExpired={isExpired}
        topLevelError={topLevelError}
      />

      <TransferSection label="Send">
        <OriginTokenCard
          isReview={isReview}
          srcChainName={srcChainName}
          srcToken={srcToken}
          sender={sender}
          onMax={onMax}
          isMaxLoading={isMaxQuoteLoading}
          isMaxDisabled={!canRequestMaxQuote || !srcToken || sourceTokenDecimals == null}
          maxUnavailableReason={maxQuoteUnavailableReason}
          hasSelectedDestinationTokenRef={hasSelectedDestinationTokenRef}
        />
      </TransferSection>

      <FlipTokensButton onClick={onFlipTokens} disabled={isReview} />

      <TransferSection label="Receive">
        <DestinationTokenCard
          isReview={isReview}
          dstChainName={dstChainName}
          dstToken={dstToken}
          recipient={effectiveRecipient}
          bestRoute={bestRoute}
          quoteLoading={quoteLoading}
          inputUsd={amountUsd}
          hasSelectedDestinationTokenRef={hasSelectedDestinationTokenRef}
        />
      </TransferSection>

      {!isReview && (
        <div className="mt-2 flex items-center justify-between gap-3 px-1">
          <FeeSectionButton
            feeBreakdown={displayedBestRoute?.feeBreakdown}
            isLoading={quoteLoading || (!!bestRoute && sourceFeeQuery.isPending)}
            inputUsd={amountUsd}
          />
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
        </div>
      )}
      <RouteSelectionModal
        isOpen={isRouteModalOpen}
        close={closeRouteModal}
        routes={routes}
        selectedIndex={safeIndex}
        onSelect={setSelectedRouteIndex}
        srcToken={srcToken}
        dstToken={dstToken}
      />

      <ReviewDetails
        isReview={isReview}
        bestRoute={displayedBestRoute}
        srcToken={srcToken}
        dstToken={dstToken}
        approvalStatus={status.phase}
        approval={approval}
      />

      <div
        className={`gap-2 bg-amber-400 px-4 text-sm ${
          showRecipientWarning ? 'max-h-38 py-2' : 'max-h-0'
        } overflow-hidden transition-all duration-500`}
      >
        <RecipientWarningBanner
          destinationChain={dstChainInfo?.displayName || dstChainName || 'the destination chain'}
          confirmRecipientHandler={(checked) =>
            setRecipientInfos((state) => ({ ...state, addressConfirmed: checked }))
          }
        />
      </div>

      <ButtonSection
        isReview={isReview}
        setIsReview={setIsReview}
        srcChainName={srcChainName ?? ''}
        dstChainName={dstChainName}
        hasAmount={hasAmount}
        hasTokens={hasTokens}
        hasRoute={!!bestRoute}
        isRouteDataUnavailable={isRouteDataUnavailable}
        isAmountDebouncing={isAmountDebouncing}
        isApprovalReady={isApprovalReady && isSourceFeeReady}
        isQuoteSettled={isQuoteSettled}
        isValidating={isValidating}
        onSendTransactions={onSendTransactions}
        sendPending={isActiveTransferInFlight}
        recipientConfirmed={addressConfirmed}
        originConnected={!!sender}
        needsRecipient={!effectiveRecipient}
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

type StarknetAccount = NonNullable<UseAccountResult['account']>;
type StarknetCalls = Parameters<StarknetAccount['estimateInvokeFee']>[0];

async function estimateStarknetExecutionFee({
  route,
  srcProtocol,
  account,
}: {
  route: AugmentedRoute | undefined;
  srcProtocol: string | undefined;
  account: StarknetAccount | undefined;
}): Promise<bigint> {
  if (srcProtocol !== ProtocolType.Starknet || !route) return 0n;
  if (!account) return 0n;

  const calls = getRouteTxs(route)
    .filter(isStarknetRouteTx)
    .map((tx) => tx.transaction);
  if (!calls.length) return 0n;

  try {
    const fee = await account.estimateInvokeFee(calls as StarknetCalls);
    return fee.suggestedMaxFee ?? fee.overall_fee ?? 0n;
  } catch (err) {
    logger.warn('Failed to estimate Starknet execution fee', err as Error);
    return 0n;
  }
}

function getRouteTxs(route: AugmentedRoute): RouteTx[] {
  return route.raw.txs?.length ? route.raw.txs : route.raw.tx ? [route.raw.tx] : [];
}

function routeTxReviewLabel(tx: RouteTx, symbol: string, index: number, count: number): string {
  const category = routeTxCategory(tx);
  if (category === 'approval') return `Approve ${symbol}`;
  if (category === 'revoke') return `Revoke ${symbol}`;
  return `Transfer${count > 1 ? ` ${index + 1}/${count}` : ''}`;
}

function routeTxCategory(tx: RouteTx): string {
  return 'category' in tx ? tx.category : 'transfer';
}

function isStarknetRouteTx(tx: RouteTx): tx is Extract<RouteTx, { protocol: string }> {
  return 'protocol' in tx && tx.protocol === ProtocolType.Starknet;
}

async function shouldReviewRecipient({
  multiProvider,
  dstChainName,
  recipient,
}: {
  multiProvider: ReturnType<typeof useMultiProvider>;
  dstChainName: string | undefined;
  recipient: string;
}): Promise<boolean> {
  if (!dstChainName || !recipient) return true;
  const balance = await getDestinationNativeBalance(multiProvider, dstChainName, recipient);
  return balance == null || balance > 0n;
}

async function getDestinationNativeBalance(
  multiProvider: ReturnType<typeof useMultiProvider>,
  chainName: string,
  recipient: string,
): Promise<bigint | null> {
  const nativeToken = multiProvider.tryGetChainMetadata(chainName)?.nativeToken;
  try {
    return await readBalance(multiProvider, {
      chainName,
      tokenAddress: nativeToken?.denom ?? ZERO_ADDRESS,
      isNative: true,
      owner: recipient,
      decimals: nativeToken?.decimals,
      symbol: nativeToken?.symbol,
      name: nativeToken?.name,
    });
  } catch (err) {
    logger.warn(`Failed to check recipient native balance on ${chainName}`, err as Error);
    return null;
  }
}

async function isSmartContract(
  multiProvider: ReturnType<typeof useMultiProvider>,
  chainName: string,
  address: string,
): Promise<{ isContract: boolean; error?: string }> {
  if (!isValidAddressEvm(address)) return { isContract: false };
  try {
    const code = await multiProvider.getViemProvider(chainName).getCode({
      address: address as Address,
    });
    if (!code || code === '0x') return { isContract: false };
    if (code.startsWith('0xef0100')) return { isContract: false };
    return { isContract: true };
  } catch (err) {
    const error = `Error checking smart contract recipient on ${chainName}`;
    logger.warn(error, err as Error);
    return { isContract: false, error };
  }
}

function WarningBanners({
  srcChainName,
  isExpired,
  topLevelError,
}: {
  srcChainName: string | undefined;
  isExpired: boolean;
  topLevelError: string | undefined;
}) {
  return (
    <div className="max-h-12 overflow-hidden sm:max-h-10">
      <WalletConnectionWarning origin={srcChainName || ''} />
      <FormWarningBanner isVisible={isExpired}>Price expired — refreshing…</FormWarningBanner>
      <FormWarningBanner isVisible={!!topLevelError}>{topLevelError}</FormWarningBanner>
    </div>
  );
}

function OriginTokenCard({
  isReview,
  srcChainName,
  srcToken,
  sender,
  onMax,
  isMaxLoading,
  isMaxDisabled,
  maxUnavailableReason,
  hasSelectedDestinationTokenRef,
}: {
  isReview: boolean;
  srcChainName: string | undefined;
  srcToken: UiToken | undefined;
  sender: string | undefined;
  onMax: () => Promise<void>;
  isMaxLoading: boolean;
  isMaxDisabled: boolean;
  maxUnavailableReason: string | undefined;
  hasSelectedDestinationTokenRef: React.MutableRefObject<boolean>;
}) {
  const { values } = useFormikContext<TransferFormValues>();
  const { data: balance } = useTokenBalance(srcToken, sender);
  const amountUsd = useTokenUsdValue(srcToken, values.amount);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <WalletDropdown chainName={srcChainName} selectionMode="origin" disabled={isReview} />
      </div>

      <div className="transfer-chain-field rounded-[7px] border border-gray-400/25 bg-white p-3 shadow-input dark:border-primary-300/[0.18] dark:bg-transparent dark:shadow-none">
        <TokenSelectField
          selectionMode="origin"
          hasSelectedDestinationTokenRef={hasSelectedDestinationTokenRef}
          disabled={isReview}
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
            onClick={onMax}
            isLoading={isMaxLoading}
            disabled={isReview || isMaxDisabled}
            disabledReason={maxUnavailableReason}
          />
        </div>
        <div className="transfer-balance mt-1 flex items-center justify-between text-xs leading-[18px] text-gray-450 dark:text-foreground-secondary">
          <span>{!amountUsd ? '$0.00' : formatUsd(amountUsd)}</span>
          <TokenBalance label="Balance" balance={balance ?? null} token={srcToken} />
        </div>
      </div>
    </div>
  );
}

function DestinationTokenCard({
  isReview,
  dstChainName,
  dstToken,
  recipient,
  bestRoute,
  quoteLoading,
  inputUsd,
  hasSelectedDestinationTokenRef,
}: {
  isReview: boolean;
  dstChainName: string | undefined;
  dstToken: UiToken | undefined;
  recipient: string;
  bestRoute: AugmentedRoute | undefined;
  quoteLoading: boolean;
  inputUsd: number | null;
  hasSelectedDestinationTokenRef: React.MutableRefObject<boolean>;
}) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { data: balance } = useTokenBalance(dstToken, recipient);

  const outputExact = useMemo(() => {
    if (!bestRoute || !dstToken) return '';
    try {
      return formatUnits(BigInt(bestRoute.raw.output), dstToken.decimals);
    } catch {
      return '';
    }
  }, [bestRoute, dstToken]);
  const outputDisplay = useMemo(() => {
    if (!bestRoute || !dstToken) return '';
    try {
      return formatDisplayAmount(BigInt(bestRoute.raw.output), dstToken.decimals);
    } catch {
      return '';
    }
  }, [bestRoute, dstToken]);
  const outputUsd = useTokenUsdValue(dstToken, outputExact);
  // Price impact = how much value the transfer loses to fees + slippage + spread.
  // Only meaningful when both sides have USD prices.
  const priceImpactPct = useMemo(() => {
    if (!inputUsd || !outputUsd) return null;
    return ((outputUsd - inputUsd) / inputUsd) * 100;
  }, [inputUsd, outputUsd]);

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
        <TokenSelectField
          selectionMode="destination"
          hasSelectedDestinationTokenRef={hasSelectedDestinationTokenRef}
          disabled={isReview}
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
          <span>
            {!outputUsd ? '$0.00' : formatUsd(outputUsd)}
            {priceImpactPct != null && (
              <span
                className={`ml-1 ${
                  priceImpactPct <= PRICE_IMPACT_DANGER_PCT
                    ? 'text-red-500'
                    : priceImpactPct <= PRICE_IMPACT_WARN_PCT
                      ? 'text-amber-600'
                      : ''
                }`}
              >
                ({priceImpactPct >= 0 ? '+' : ''}
                {priceImpactPct.toLocaleString('en-US', PCT_FORMAT_OPTIONS)}%)
              </span>
            )}
          </span>
          <TokenBalance label="Remote Balance" balance={balance ?? null} token={dstToken} />
        </div>
      </div>
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
        className="flip-tokens-button group flex h-8 w-8 items-center justify-center rounded border border-gray-400/50 bg-white shadow-button transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-primary-300/35 dark:bg-background/90 dark:shadow-none dark:hover:bg-primary-300/[0.18]"
      >
        <SwapIcon
          width={18}
          height={24}
          className="flip-tokens-icon transition-transform duration-300 group-hover:rotate-180 group-disabled:rotate-0 dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.55)] dark:[&_path]:fill-white"
        />
      </button>
    </div>
  );
}

function ReviewDetails({
  isReview,
  bestRoute,
  srcToken,
  dstToken,
  approvalStatus,
  approval,
}: {
  isReview: boolean;
  bestRoute: AugmentedRoute | undefined;
  srcToken: UiToken | undefined;
  dstToken: UiToken | undefined;
  approvalStatus: ApprovalPhase;
  approval: AugmentedRoute['raw']['approval'] | null;
}) {
  return (
    <>
      <div
        className={`${
          isReview ? 'max-h-screen duration-1000 ease-in' : 'max-h-0 duration-500'
        } overflow-hidden transition-all`}
      >
        <label className="transfer-field-label mt-4 block pl-0.5 text-sm text-gray-600 dark:text-foreground-secondary">
          Transactions
        </label>
        <div
          data-testid="transfer-review"
          className="transfer-review-panel mt-1.5 space-y-2 break-all rounded border border-gray-400 bg-gray-150 px-2.5 py-2 text-sm dark:border-primary-300/25 dark:bg-background/40 dark:text-foreground-primary"
        >
          {bestRoute ? (
            <ReviewTransactions
              route={bestRoute}
              srcToken={srcToken}
              dstToken={dstToken}
              approvalStatus={approvalStatus}
              approval={approval}
            />
          ) : (
            <p className="text-xs text-gray-500">No route to review.</p>
          )}
        </div>
      </div>
    </>
  );
}

function ReviewTransactions({
  route,
  srcToken,
  dstToken,
  approvalStatus,
  approval,
}: {
  route: AugmentedRoute;
  srcToken: UiToken | undefined;
  dstToken: UiToken | undefined;
  approvalStatus: ApprovalPhase;
  approval: AugmentedRoute['raw']['approval'] | null;
}) {
  const tokenMap = useTokenByKeyMap();
  const multiProvider = useMultiProvider();
  const approvalUnknown = approvalStatus === ApprovalPhase.Failed;
  const needsRevoke = approvalStatus === ApprovalPhase.NeedsRevoke || approvalUnknown;
  const needsApprove =
    approvalStatus === ApprovalPhase.NeedsApprove ||
    approvalStatus === ApprovalPhase.NeedsRevoke ||
    approvalUnknown;
  const symbol = srcToken?.symbol ?? 'token';
  const approvalToken = approval?.token ?? srcToken?.address;
  const approvalSpender = approval?.spender;
  const dstDecimals = dstToken?.decimals ?? 18;
  const dstSymbol = dstToken?.symbol ?? '';
  const routeTxs = getRouteTxs(route);

  let txNum = 0;
  return (
    <>
      {needsRevoke && (
        <div>
          <h4 data-testid="transfer-review-transaction" data-category="revoke">
            {`Transaction ${++txNum}: Revoke ${symbol}${approvalUnknown ? ' (if required)' : ''}`}
          </h4>
          <div className="ml-1.5 mt-1.5 space-y-1.5 border-l border-gray-300 pl-2 text-xs dark:border-primary-300/25">
            <p>{`Token: ${approvalToken}`}</p>
            <p>{`Spender: ${approvalSpender ?? '—'}`}</p>
            <p>Reset existing allowance to 0 before re-approving (USDT-style).</p>
          </div>
        </div>
      )}
      {needsApprove && (
        <div>
          <h4 data-testid="transfer-review-transaction" data-category="approval">
            {`Transaction ${++txNum}: Approve ${symbol}${approvalUnknown ? ' (if required)' : ''}`}
          </h4>
          <div className="ml-1.5 mt-1.5 space-y-1.5 border-l border-gray-300 pl-2 text-xs dark:border-primary-300/25">
            <p>{`Token: ${approvalToken}`}</p>
            <p>{`Spender: ${approvalSpender ?? '—'}`}</p>
            <p>
              Amount-based approval — re-prompted when next transfer exceeds the remaining
              allowance.
            </p>
          </div>
        </div>
      )}
      <div>
        {routeTxs.map((tx, index) => (
          <h4
            key={index}
            data-testid="transfer-review-transaction"
            data-category={routeTxCategory(tx)}
          >
            {`Transaction ${++txNum}: ${routeTxReviewLabel(tx, symbol, index, routeTxs.length)}`}
          </h4>
        ))}
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
          {!route.hasFixedOutput && (
            <p className="flex">
              <span className="min-w-[7.5rem]">Min Output</span>
              <span>{`${formatDisplayAmount(BigInt(route.raw.outputMin), dstDecimals)} ${dstSymbol}`}</span>
            </p>
          )}
          {route.feeBreakdown.components
            .filter((c) => c.amount > 0n)
            .map((c, i) => {
              const label =
                c.category === 'bridge'
                  ? 'Route Fee'
                  : c.category === 'igp'
                    ? 'Interchain Gas'
                    : 'Network Fee';
              const isNative = /^0x0+$/i.test(c.tokenAddress);
              const componentChainName =
                multiProvider.tryGetChainName(c.chainId) ?? `chain-${c.chainId}`;
              const nativeMeta = isNative
                ? multiProvider.tryGetChainMetadata(componentChainName)?.nativeToken
                : undefined;
              const componentToken = isNative
                ? undefined
                : getTokenByKeyFromMap(tokenMap, tokenKey(c.chainId, c.tokenAddress));
              const decimals = isNative
                ? (nativeMeta?.decimals ?? 18)
                : (componentToken?.decimals ?? 18);
              const sym = isNative
                ? (nativeMeta?.symbol ?? 'ETH')
                : (componentToken?.symbol ?? '???');
              return (
                <p key={`${c.category}-${c.chainId}-${c.tokenAddress}-${i}`} className="flex">
                  <span className="min-w-[7.5rem]">{label}</span>
                  <span>{`${formatFeeAmount(c.amount, decimals)} ${sym}`}</span>
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
  hasRoute,
  isRouteDataUnavailable,
  isAmountDebouncing,
  isApprovalReady,
  isQuoteSettled,
  isValidating,
  onSendTransactions,
  sendPending,
  recipientConfirmed,
  originConnected,
  needsRecipient,
}: {
  isReview: boolean;
  setIsReview: (b: boolean) => void;
  srcChainName: string;
  dstChainName: string | undefined;
  hasAmount: boolean;
  hasTokens: boolean;
  hasRoute: boolean;
  isRouteDataUnavailable: boolean;
  isAmountDebouncing: boolean;
  isApprovalReady: boolean;
  isQuoteSettled: boolean;
  isValidating: boolean;
  onSendTransactions: () => Promise<void>;
  sendPending: boolean;
  recipientConfirmed: boolean;
  originConnected: boolean;
  needsRecipient: boolean;
}) {
  const multiProvider = useMultiProvider();
  const dstMetadata = dstChainName ? multiProvider.tryGetChainMetadata(dstChainName) : undefined;
  const dstDisplay = dstMetadata?.displayName ?? dstMetadata?.name ?? dstChainName ?? 'destination';

  // Origin connected but recipient still missing (no custom recipient and no
  // connected destination wallet): prompt the destination wallet connect instead
  // of the empty-quote "Route is not supported". Amount is inconsequential here —
  // the connect prompt only depends on wallet/recipient state.
  const promptDestConnect = originConnected && needsRecipient && hasTokens && !!dstChainName;
  const connectChainName = promptDestConnect && dstChainName ? dstChainName : srcChainName;

  let text = 'Continue';
  let disabled = false;
  if (!hasTokens) {
    text = 'Select tokens';
    disabled = true;
  } else if (!hasAmount) {
    text = 'Enter amount';
    disabled = true;
  } else if (hasRoute) {
    if (isValidating) {
      text = 'Checking…';
      disabled = true;
    } else if (isAmountDebouncing) {
      text = 'Fetching quote…';
      disabled = true;
    } else if (!isApprovalReady) {
      text = 'Fetching quote…';
      disabled = true;
    } else {
      text = 'Continue';
      disabled = false;
    }
  } else if (isRouteDataUnavailable) {
    text = 'Route data unavailable';
    disabled = true;
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
        chainName={connectChainName}
        text={text}
        disabled={disabled || !recipientConfirmed}
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
        data-testid="transfer-send"
        type="button"
        color="accent"
        onClick={onSendTransactions}
        disabled={sendPending || !recipientConfirmed}
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
  const { submitCount } = useFormikContext<TransferFormValues>();
  useEffect(() => {
    if (submitCount === 0 || isReview) return;
    onContinue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitCount]);
  return null;
}
