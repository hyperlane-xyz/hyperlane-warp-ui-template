import { objLength } from '@hyperlane-xyz/utils';
import { logger } from '../../utils/logger';
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
import { ApprovalPhase, useApprovalStatus } from './approval';
import { useTokenBalance } from './balances/hooks';
import { formatDisplayAmount, formatFeeAmount, formatUsd } from './balances/utils';
import { FeeSectionButton } from './FeeSectionButton';
import { MaxButton } from './MaxButton';
import { RouteSelectionModal } from './routeSelection/RouteSelectionModal';
import { SlippagePanel } from './SlippagePanel';
import { TokenBalance } from './TokenBalance';
import { getTokenByKeyFromMap, useTokenByKeyMap } from './tokens/hooks';
import { TokenSelectField } from './tokens/TokenSelectField';
import type { UiToken } from './tokens/types';
import { useTokenPrices, useTokenUsdValue } from './tokens/useTokenPrice';
import {
  FinalSwapStatuses,
  SwapStatus,
  type AugmentedRoute,
  type SwapFormValues,
  type SwapHistoryItem,
} from './types';
import { useFormInitialValues } from './useFormInitialValues';
import { useQuote } from './useQuote';
import { useSwap } from './useSwap';
import { validateSwapForm } from './validate';

const PRICE_IMPACT_DANGER_PCT = -3;
const PRICE_IMPACT_WARN_PCT = -1;
const PCT_FORMAT_OPTIONS = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

export function SwapForm() {
  const initialValues = useFormInitialValues();
  return (
    <Formik<SwapFormValues>
      initialValues={initialValues}
      enableReinitialize
      onSubmit={() => undefined}
      validateOnChange={false}
      validateOnBlur={false}
    >
      <Form className="swap-form flex w-full flex-col items-stretch gap-1.5">
        <SwapFormContent />
      </Form>
    </Formik>
  );
}

function SwapFormContent() {
  const { values, errors, setErrors, setFieldValue, setValues } =
    useFormikContext<SwapFormValues>();
  const multiProvider = useMultiProvider();
  const tokenMap = useTokenByKeyMap();
  const { data: chainsResp } = useChains();
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
  const srcToken = getTokenByKeyFromMap(tokenMap, srcTokenKey);
  const dstToken = getTokenByKeyFromMap(tokenMap, dstTokenKey);

  // Engine /v1/chains gives us the UR per chain. Permit2 address is also
  // in the response but unused — classic ERC20.approve(UR) doesn't need it.
  const srcChainInfo = chainsResp?.chains.find((c) => c.id === values.srcChain);
  const universalRouter = srcChainInfo?.universalRouter as Address | undefined;

  const [isReview, setIsReview] = useState(false);
  const { close: closeConfirmationModal, isOpen: isConfirmationModalOpen } = useModal();
  const { isOpen: isRouteModalOpen, open: openRouteModal, close: closeRouteModal } = useModal();
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

  const debouncedAmount = useDebounce(values.amount, 750);
  const {
    quote,
    isLoading: quoteLoading,
    error: quoteError,
    isExpired,
    isQuoteSettled,
  } = useQuote({
    values: { ...values, amount: debouncedAmount, recipient: effectiveRecipient },
    sender,
    pause: isReview,
  });
  useToastError(quoteError, 'Quote failed');

  // Reset to best route when the user changes intent, not on every background refetch.
  useEffect(() => {
    setSelectedRouteIndex(0);
  }, [values.srcChain, values.dstChain, values.srcToken, values.dstToken, debouncedAmount]);

  const routes = quote?.routes ?? [];
  const safeIndex = selectedRouteIndex < routes.length ? selectedRouteIndex : 0;
  const bestRoute = routes[safeIndex] ?? routes[0];

  const isNative = !!srcToken?.isNative;
  const amountAtomic = useMemo(() => {
    const initialStep = bestRoute?.raw.steps[0];
    if (initialStep && 'amountIn' in initialStep) return BigInt(initialStep.amountIn);
    return undefined;
  }, [bestRoute]);

  // Input USD — used by the fee % calculation in FeeSectionButton.
  const amountUsd = useTokenUsdValue(srcToken, values.amount);

  const status = useApprovalStatus({
    chainName: srcChainName,
    token: srcToken?.address as Address | undefined,
    owner: sender,
    spender: universalRouter,
    amount: amountAtomic,
    isNative,
  });

  const swap = useSwap();
  useToastError(swap.error, 'Swap failed');
  const addSwapTransaction = useStore((s) => s.addSwapTransaction);
  const setSelectedTransactionId = useStore((s) => s.setSelectedTransactionId);
  const setActiveSwapTransactionId = useStore((s) => s.setActiveSwapTransactionId);
  const updateSwapTransactionStatus = useStore((s) => s.updateSwapTransactionStatus);
  const setSwapLoading = useStore((s) => s.setSwapLoading);

  // Send-button gating tracks the active execution, not the transaction selected
  // for history/modals. Viewing an old pending swap should not disable the form.
  const activeSwap = useStore((s) =>
    s.activeSwapTransactionId != null
      ? s.transactionHistory.find((item) => item.id === s.activeSwapTransactionId)
      : undefined,
  );
  const isActiveSwapInFlight =
    activeSwap?.type === TransactionHistoryItemType.Swap &&
    !FinalSwapStatuses.includes(activeSwap.data.status);

  const hasAmount = !!values.amount && Number(values.amount) > 0;
  const hasTokens = !!srcToken && !!dstToken;

  const [isValidating, setIsValidating] = useState(false);

  // Validate is async; the user can keep editing while it runs. We
  // capture the values reference at request start and bail on resolve
  // if the latest Formik values have changed — otherwise we'd flip into
  // review mode on a form the user has already mutated.
  const latestValuesRef = useRef(values);
  useEffect(() => {
    latestValuesRef.current = values;
  }, [values]);

  const onContinue = useCallback(async () => {
    const snapshot = values;
    setIsValidating(true);
    try {
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
      // Discard the result if the user edited the form while we were
      // validating — otherwise we'd enter review mode on stale data.
      if (latestValuesRef.current !== snapshot) return;
      if (result) {
        logger.error('Continue blocked by validation', result);
        setErrors(result);
        return;
      }
      if (!sender || !srcToken || !dstToken || !bestRoute || !effectiveRecipient) {
        logger.error('Continue blocked: missing required field', {
          sender,
          srcToken: !!srcToken,
          dstToken: !!dstToken,
          bestRoute: !!bestRoute,
          effectiveRecipient,
        });
        return;
      }
      setErrors({});
      setIsReview(true);
    } catch (err) {
      logger.error('onContinue threw unexpectedly', err as Error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setErrors({ form: err instanceof Error ? err.message : 'Unexpected error — check console' } as any);
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
    chainsResp?.chains,
    multiProvider,
    status.phase,
    quote?.expiresAt,
    setErrors,
  ]);

  const onSendTransactions = useCallback(async () => {
    if (!sender || !srcToken || !dstToken || !bestRoute || !values.srcChain || !values.dstChain) {
      return;
    }

    // Re-validate before broadcasting. Review mode pauses useQuote, so a
    // user can sit on review past expiresAt with a stale quote — without
    // this check we'd happily submit it. Same call as Continue plus the
    // current quote.expiresAt so the staleness check fires.
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
    // Same race as onContinue — if the form changed mid-validation,
    // discard the result. In practice the inputs are disabled in review
    // mode, but the wallet dropdown can still change the recipient.
    if (latestValuesRef.current !== snapshot) return;
    if (validationResult) {
      // Bail back to edit mode so the user sees the error and the form
      // unpauses useQuote to refresh.
      setErrors(validationResult);
      setIsReview(false);
      return;
    }

    // Bridge-style: drop review immediately so the form stays editable
    // while the broadcast chain runs. Modal carries the live status.
    setIsReview(false);
    setSwapLoading(true);

    const initialStep = bestRoute.raw.steps[0];
    const finalStep = bestRoute.raw.steps[bestRoute.raw.steps.length - 1];
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
      solanaDestSwapPda:
        bestRoute.raw.callCommitment?.ccs.body.revealAccounts?.[0]?.pubkey,
    };
    const transactionId = addSwapTransaction(item);
    setSelectedTransactionId(transactionId);
    setActiveSwapTransactionId(transactionId);

    try {
      // useSwap.execute handles revoke / approve / swap sequencing
      // internally based on the params below.
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
    sender,
    srcToken,
    dstToken,
    bestRoute,
    values,
    effectiveRecipient,
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

  const onSwapChains = useCallback(() => {
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
          amountError={errors.amount}
        />
      </TransferSection>

      <SwapTokensButton onClick={onSwapChains} disabled={isReview} />

      <TransferSection label="Receive">
        <DestinationTokenCard
          isReview={isReview}
          dstChainName={dstChainName}
          dstToken={dstToken}
          recipient={effectiveRecipient}
          bestRoute={bestRoute}
          quoteLoading={quoteLoading}
          recipientError={errors.recipient}
          inputUsd={amountUsd}
        />
      </TransferSection>

      {!isReview && (
        <div className="mt-2 flex items-center justify-between gap-3 px-1">
          <FeeSectionButton
            feeBreakdown={bestRoute?.feeBreakdown}
            isLoading={quoteLoading}
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
        dstToken={dstToken}
      />

      <ReviewDetails
        isReview={isReview}
        bestRoute={bestRoute}
        srcToken={srcToken}
        dstToken={dstToken}
        approvalStatus={status.phase}
        universalRouter={universalRouter}
      />

      <ButtonSection
        isReview={isReview}
        setIsReview={setIsReview}
        srcChainName={srcChainName ?? ''}
        dstChainName={dstChainName}
        hasAmount={hasAmount}
        hasTokens={hasTokens}
        hasRoute={!!bestRoute}
        isQuoteSettled={isQuoteSettled}
        isValidating={isValidating}
        onSendTransactions={onSendTransactions}
        sendPending={isActiveSwapInFlight}
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
  amountError,
}: {
  isReview: boolean;
  srcChainName: string | undefined;
  srcToken: UiToken | undefined;
  amountError: string | undefined;
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
        <TokenSelectField selectionMode="origin" disabled={isReview} />

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
        <p className="transfer-field-error mt-1 pl-1 text-xs text-red-500 dark:text-red-400">
          {amountError}
        </p>
      )}
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
  recipientError,
  inputUsd,
}: {
  isReview: boolean;
  dstChainName: string | undefined;
  dstToken: UiToken | undefined;
  recipient: string;
  bestRoute: AugmentedRoute | undefined;
  quoteLoading: boolean;
  recipientError: string | undefined;
  inputUsd: number | null;
}) {
  const { values, setFieldValue } = useFormikContext<SwapFormValues>();
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
  // Price impact = how much value the swap loses to fees + slippage + spread.
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
        <TokenSelectField selectionMode="destination" disabled={isReview} />

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
      {recipientError && (
        <p className="transfer-field-error mt-1 pl-1 text-xs text-red-500 dark:text-red-400">
          {recipientError}
        </p>
      )}
    </div>
  );
}

function SwapTokensButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
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

function ReviewDetails({
  isReview,
  bestRoute,
  srcToken,
  dstToken,
  approvalStatus,
  universalRouter,
}: {
  isReview: boolean;
  bestRoute: AugmentedRoute | undefined;
  srcToken: UiToken | undefined;
  dstToken: UiToken | undefined;
  approvalStatus: ApprovalPhase;
  universalRouter: Address | undefined;
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
        <div className="transfer-review-panel mt-1.5 space-y-2 break-all rounded border border-gray-400 bg-gray-150 px-2.5 py-2 text-sm dark:border-primary-300/25 dark:bg-background/40 dark:text-foreground-primary">
          {bestRoute ? (
            <ReviewTransactions
              route={bestRoute}
              srcToken={srcToken}
              dstToken={dstToken}
              approvalStatus={approvalStatus}
              universalRouter={universalRouter}
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
  universalRouter,
}: {
  route: AugmentedRoute;
  srcToken: UiToken | undefined;
  dstToken: UiToken | undefined;
  approvalStatus: ApprovalPhase;
  universalRouter: Address | undefined;
}) {
  const tokenMap = useTokenByKeyMap();
  const multiProvider = useMultiProvider();
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
            <p>
              Amount-based approval — re-prompted when next swap exceeds the remaining allowance.
            </p>
          </div>
        </div>
      )}
      <div>
        <h4>{`Transaction ${++txNum}: Swap`}</h4>
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
                : getTokenByKeyFromMap(tokenMap, `${c.chainId}-${c.tokenAddress.toLowerCase()}`);
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
  hasRoute: boolean;
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
  } else if (hasRoute) {
    if (isValidating) {
      text = 'Checking…';
      disabled = true;
    } else {
      text = 'Continue';
      disabled = false;
    }
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
