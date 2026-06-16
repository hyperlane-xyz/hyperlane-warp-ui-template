import { Token } from '@hyperlane-xyz/sdk';
import {
  ProtocolType,
  eqAddress,
  errorToString,
  fromWei,
  isNullish,
  isValidAddressEvm,
  toWei,
} from '@hyperlane-xyz/utils';
import { useDebounce, useModal } from '@hyperlane-xyz/widgets';
import {
  getAccountAddressAndPubKey,
  useAccountAddressForChain,
  useAccounts,
} from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { useMutation, useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import { Form, Formik, useFormikContext } from 'formik';
import { useEffect, useMemo, useState } from 'react';
import { type Address } from 'viem';

import { RecipientWarningBanner } from '../../components/banner/RecipientWarningBanner';
import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { SwapIcon } from '../../components/icons/SwapIcon';
import { TextField } from '../../components/input/TextField';
import { TransferSection } from '../../components/layout/TransferSection';
import { config } from '../../consts/config';
import { formatDisplayAmount } from '../../utils/amount';
import { logger } from '../../utils/logger';
import { updateQueryParams } from '../../utils/queryParams';
import { useChains } from '../api/hooks';
import { getDestinationNativeBalance, useOriginBalance } from '../balances/hooks';
import { ChainConnectionWarning } from '../chains/ChainConnectionWarning';
import { ChainWalletWarning } from '../chains/ChainWalletWarning';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { useIsAccountSanctioned } from '../sanctions/hooks/useIsAccountSanctioned';
import { TransactionHistoryItemType, useStore } from '../store';
import { ApprovalPhase, useApprovalStatus } from '../swap/approval';
import { useTokenBalance as useSwapTokenBalance } from '../swap/balances/hooks';
import {
  formatBalance as formatSwapBalance,
  formatFeeAmount,
  formatUsd,
  getTotalFeeUsd,
} from '../swap/balances/utils';
import { useTokenByKeyMap as useSwapTokenByKeyMap } from '../swap/tokens/hooks';
import { useTokenPrices as useSwapTokenPrices } from '../swap/tokens/useTokenPrice';
import {
  FinalSwapStatuses,
  SwapStatus,
  type AugmentedRoute,
  type SwapHistoryItem,
} from '../swap/types';
import { useQuote } from '../swap/useQuote';
import { useSwap } from '../swap/useSwap';
import { validateSwapForm } from '../swap/validate';
import { useCollateralGroups, useTokenByKeyMap, useWarpCore } from '../tokens/hooks';
import { ImportTokenButton } from '../tokens/ImportTokenButton';
import { getTokenKey as getBridgeTokenKey } from '../tokens/utils';
import { useTokenTransfer } from '../transfer/useTokenTransfer';
import { isSmartContract, shouldClearAddress } from '../transfer/utils';
import { validateBridgeTransferForm } from '../transfer/validate';
import { RecipientConfirmationModal } from '../wallet/RecipientConfirmationModal';
import { WalletConnectionWarning } from '../wallet/WalletConnectionWarning';
import { WalletDropdown } from '../wallet/WalletDropdown';
import {
  getExactInputBridgeMaxAmount,
  getExactInputBridgeTransferQuote,
  type ExactInputBridgeTransferQuote,
} from './bridgeExactInput';
import { useUnifiedTokenByKeyMap, useUnifiedTokens } from './tokens/hooks';
import { getInitialUnifiedTokenKeys } from './tokens/initial';
import { getUnifiedTokenQueryParams } from './tokens/queryParams';
import { getUnifiedRouteMode, UnifiedRouteMode } from './tokens/routes';
import { TokenSelectField } from './tokens/TokenSelectField';
import type { UnifiedToken } from './tokens/types';
import type { UnifiedFormValues } from './types';
import { getUnifiedBasicSubmitErrors } from './validation';

export function UnifiedTokenCard() {
  return (
    <div className="relative w-100 sm:w-[31rem]">
      <UnifiedTokenForm />
    </div>
  );
}

function UnifiedTokenForm() {
  const { data: tokens, engineEnabled } = useUnifiedTokens();
  const tokenMap = useUnifiedTokenByKeyMap(tokens);
  const collateralGroups = useCollateralGroups();

  const initialValues = useMemo<UnifiedFormValues>(() => {
    const { originTokenKey, destinationTokenKey } = getInitialUnifiedTokenKeys({
      tokens,
      collateralGroups,
      engineEnabled,
    });

    return {
      originTokenKey,
      destinationTokenKey,
      amount: '',
      recipient: '',
      slippageBps: config.defaultSlippageBps,
    };
  }, [tokens, collateralGroups, engineEnabled]);

  return (
    <Formik<UnifiedFormValues>
      initialValues={initialValues}
      enableReinitialize
      onSubmit={() => undefined}
      validateOnChange={false}
      validateOnBlur={false}
    >
      <Form className="transfer-form flex w-full flex-col items-stretch gap-1.5">
        <UnifiedFormContent tokenMap={tokenMap} engineEnabled={engineEnabled} />
      </Form>
    </Formik>
  );
}

function UnifiedFormContent({
  tokenMap,
  engineEnabled,
}: {
  tokenMap: Map<string, UnifiedToken>;
  engineEnabled: boolean;
}) {
  const { values, errors, setValues, setErrors } = useFormikContext<UnifiedFormValues>();
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();
  const collateralGroups = useCollateralGroups();
  const bridgeTokenMap = useTokenByKeyMap();
  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);
  const { routerAddressesByChainMap } = useStore((s) => ({
    routerAddressesByChainMap: s.routerAddressesByChainMap,
  }));
  const originToken = values.originTokenKey ? tokenMap.get(values.originTokenKey) : undefined;
  const destinationToken = values.destinationTokenKey
    ? tokenMap.get(values.destinationTokenKey)
    : undefined;
  const routeMode = getUnifiedRouteMode({
    originToken,
    destinationToken,
    collateralGroups,
    engineEnabled,
  });
  const isSanctioned = useIsAccountSanctioned(routeMode === UnifiedRouteMode.Bridge);
  const destinationChainDisplay = destinationToken
    ? getChainDisplayName(multiProvider, destinationToken.chainName)
    : '';
  const [{ addressConfirmed, showRecipientWarning }, setRecipientWarning] = useState({
    addressConfirmed: true,
    showRecipientWarning: false,
  });
  const { data: chainsResp } = useChains();
  const sender = useAccountAddressForChain(multiProvider, originToken?.chainName);
  const connectedDestAddress = useAccountAddressForChain(
    multiProvider,
    destinationToken?.chainName,
  );
  const effectiveRecipient = values.recipient || connectedDestAddress || '';

  const swapValues = useMemo(
    () => ({
      srcChain: originToken?.swapToken?.chainId ?? null,
      dstChain: destinationToken?.swapToken?.chainId ?? null,
      srcToken: originToken?.swapToken?.address ?? '',
      dstToken: destinationToken?.swapToken?.address ?? '',
      amount: values.amount,
      recipient: values.recipient,
      slippageBps: values.slippageBps,
    }),
    [originToken, destinationToken, values],
  );
  const quote = useQuote({
    values: { ...swapValues, recipient: effectiveRecipient },
    sender,
    pause: routeMode !== UnifiedRouteMode.Swap,
  });
  const routes = quote.quote?.routes ?? [];
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const bestRoute = routes[selectedRouteIndex] ?? routes[0];

  const srcChainInfo = chainsResp?.chains.find((c) => c.id === swapValues.srcChain);
  const universalRouter = srcChainInfo?.universalRouter as Address | undefined;
  const amountAtomic = useMemo(() => {
    const initialStep = bestRoute?.raw.steps[0];
    if (initialStep && 'amountIn' in initialStep) return BigInt(initialStep.amountIn);
    return undefined;
  }, [bestRoute]);
  const approvalStatus = useApprovalStatus({
    chainName: originToken?.chainName,
    token: originToken?.swapToken?.address as Address | undefined,
    owner: sender,
    spender: universalRouter,
    amount: amountAtomic,
    isNative: !!originToken?.swapToken?.isNative,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    open: openConfirmationModal,
    close: closeConfirmationModal,
    isOpen: isConfirmationModalOpen,
  } = useModal();
  const bridgeTransfer = useTokenTransfer(() => setIsSubmitting(false));
  const swap = useSwap();
  const bridgeQuote = useBridgeExactInputQuote({
    routeMode,
    originToken,
    destinationToken,
    amount: values.amount,
    recipient: effectiveRecipient,
    sender,
  });

  useEffect(() => {
    if (selectedRouteIndex >= routes.length) setSelectedRouteIndex(0);
  }, [routes.length, selectedRouteIndex]);

  useEffect(() => {
    let isMounted = true;

    const reset = () =>
      setRecipientWarning({ addressConfirmed: true, showRecipientWarning: false });

    const checkSameEvmRecipient = async () => {
      if (
        routeMode !== UnifiedRouteMode.Bridge ||
        !sender ||
        !originToken?.bridgeToken ||
        !destinationToken?.bridgeToken ||
        !isValidAddressEvm(effectiveRecipient)
      ) {
        reset();
        return;
      }

      const { protocol: originProtocol } = multiProvider.getChainMetadata(originToken.chainName);
      const { protocol: destinationProtocol } = multiProvider.getChainMetadata(
        destinationToken.chainName,
      );
      if (
        originProtocol !== ProtocolType.Ethereum ||
        destinationProtocol !== ProtocolType.Ethereum
      ) {
        reset();
        return;
      }

      const { isContract: isSenderSmartContract, error: senderCheckError } = await isSmartContract(
        multiProvider,
        originToken.chainName,
        sender,
      );
      if (!isMounted) return;

      const { isContract: isRecipientSmartContract, error: recipientCheckError } =
        await isSmartContract(multiProvider, destinationToken.chainName, effectiveRecipient);
      if (!isMounted) return;

      if (senderCheckError || recipientCheckError) {
        logger.warn(senderCheckError || recipientCheckError);
        reset();
        return;
      }

      const shouldWarn =
        eqAddress(effectiveRecipient, sender) && isSenderSmartContract && !isRecipientSmartContract;
      setRecipientWarning({
        addressConfirmed: !shouldWarn,
        showRecipientWarning: shouldWarn,
      });
    };

    void checkSameEvmRecipient();

    return () => {
      isMounted = false;
    };
  }, [routeMode, sender, originToken, destinationToken, effectiveRecipient, multiProvider]);

  const onSwapTokens = () => {
    if (originToken && destinationToken) {
      updateQueryParams({
        ...getUnifiedTokenQueryParams(destinationToken, 'origin'),
        ...getUnifiedTokenQueryParams(originToken, 'destination'),
      });
    }

    setValues((prev) => ({
      ...prev,
      amount: '',
      originTokenKey: prev.destinationTokenKey,
      destinationTokenKey: prev.originTokenKey,
      recipient:
        originToken && shouldClearAddress(multiProvider, prev.recipient, originToken.chainName)
          ? ''
          : prev.recipient,
    }));
  };

  const onSubmit = async (skipRecipientBalanceCheck = false) => {
    const basicErrors = getUnifiedBasicSubmitErrors({
      routeMode,
      values,
      originToken,
      destinationToken,
      recipient: effectiveRecipient,
      hasSwapRoute: !!bestRoute,
    });
    if (basicErrors) {
      setErrors(basicErrors);
      return;
    }
    if (routeMode === UnifiedRouteMode.Bridge && (isSanctioned || !addressConfirmed)) return;

    if (routeMode === UnifiedRouteMode.Bridge) {
      const validationErrors = await validateUnifiedBridgeTransfer({
        warpCore,
        bridgeTokenMap,
        collateralGroups,
        values,
        originToken,
        destinationToken,
        recipient: effectiveRecipient,
        sender,
        accounts,
        routerAddressesByChainMap,
      });
      if (validationErrors) {
        setErrors(validationErrors);
        return;
      }
      if (!skipRecipientBalanceCheck) {
        const balance = await getDestinationNativeBalance(multiProvider, {
          destination: destinationToken!.chainName,
          recipient: effectiveRecipient,
        });
        if (isNullish(balance)) return;
        if (balance === 0n) {
          openConfirmationModal();
          return;
        }
      }
    } else {
      if (!bestRoute) return;
    }

    setIsSubmitting(true);
    try {
      if (routeMode === UnifiedRouteMode.Bridge) {
        await submitBridge({
          values,
          originToken,
          destinationToken,
          recipient: effectiveRecipient,
          sender,
          bridgeTransfer,
        });
        return;
      }

      if (routeMode === UnifiedRouteMode.Swap) {
        await submitSwap({
          values: swapValues,
          bestRoute,
          originToken,
          destinationToken,
          sender,
          recipient: effectiveRecipient,
          chains: chainsResp?.chains,
          multiProvider,
          approvalPending:
            approvalStatus.phase === ApprovalPhase.NeedsApprove ||
            approvalStatus.phase === ApprovalPhase.NeedsRevoke,
          quoteExpiresAt: quote.quote?.expiresAt,
          universalRouter,
          amountAtomic,
          swap,
          setErrors,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttonText = !routeMode
    ? 'Route is not supported'
    : isSubmitting
      ? 'Sending...'
      : `Send ${routeMode}`;

  useEffect(() => {
    if (Object.keys(errors).length) setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    values.originTokenKey,
    values.destinationTokenKey,
    values.amount,
    values.recipient,
    routeMode,
  ]);

  return (
    <>
      <UnifiedWarningBanners originToken={originToken} destinationToken={destinationToken} />

      <TransferSection label="Send">
        <OriginTokenCard
          token={originToken}
          destinationToken={destinationToken}
          tokenMap={tokenMap}
          engineEnabled={engineEnabled}
          routeMode={routeMode}
        />
      </TransferSection>
      <div className="relative z-10 -my-3 flex justify-center">
        <button
          type="button"
          onClick={onSwapTokens}
          className="swap-chains-button group flex h-8 w-8 items-center justify-center rounded border border-gray-400/50 bg-white shadow-button transition-all hover:bg-gray-50 dark:border-primary-300/35 dark:bg-background/90 dark:shadow-none dark:hover:bg-primary-300/[0.18]"
        >
          <SwapIcon
            width={18}
            height={24}
            className="swap-chains-icon transition-transform duration-300 group-hover:rotate-180 dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.55)] dark:[&_path]:fill-white"
          />
        </button>
      </div>
      <TransferSection label="Receive">
        <DestinationTokenCard
          token={destinationToken}
          tokenMap={tokenMap}
          engineEnabled={engineEnabled}
          routeMode={routeMode}
          bestRoute={bestRoute}
          bridgeQuote={bridgeQuote.data}
          isQuoteLoading={quote.isLoading || bridgeQuote.isLoading || bridgeQuote.isFetching}
        />
      </TransferSection>

      <div className="mb-2 mt-2 flex items-center justify-between px-1 text-xs text-gray-500">
        <span>{routeMode ? `Route: ${routeMode}` : 'No route available'}</span>
        {routeMode === UnifiedRouteMode.Swap && <SlippageControl />}
        {!engineEnabled && <span>Bridge only</span>}
      </div>
      {routeMode === UnifiedRouteMode.Swap && (
        <RouteSelector
          routes={routes}
          selectedIndex={selectedRouteIndex}
          setSelectedIndex={setSelectedRouteIndex}
          destinationToken={destinationToken}
        />
      )}
      {routeMode === UnifiedRouteMode.Bridge && <BridgeFeeSummary quote={bridgeQuote.data} />}
      {routeMode === UnifiedRouteMode.Swap && <SwapFeeSummary route={bestRoute} />}

      <div
        className={`gap-2 bg-amber-400 px-4 text-sm ${
          showRecipientWarning ? 'max-h-38 py-2' : 'max-h-0'
        } overflow-hidden transition-all duration-500`}
      >
        <RecipientWarningBanner
          destinationChain={destinationChainDisplay}
          confirmRecipientHandler={(checked) =>
            setRecipientWarning((state) => ({ ...state, addressConfirmed: checked }))
          }
        />
      </div>

      <ConnectAwareSubmitButton<UnifiedFormValues>
        chainName={originToken?.chainName || ''}
        text={buttonText}
        onClickWhenReady={onSubmit}
        disabled={
          isSubmitting ||
          (routeMode === UnifiedRouteMode.Bridge && (isSanctioned || !addressConfirmed))
        }
        classes="mb-4 w-full px-3 py-2.5 font-secondary text-xl text-cream-100"
      />
      <RecipientConfirmationModal
        isOpen={isConfirmationModalOpen}
        close={closeConfirmationModal}
        onConfirm={() => void onSubmit(true)}
        recipient={effectiveRecipient}
        destinationChainDisplay={destinationChainDisplay}
      />
    </>
  );
}

function UnifiedWarningBanners({
  originToken,
  destinationToken,
}: {
  originToken: UnifiedToken | undefined;
  destinationToken: UnifiedToken | undefined;
}) {
  const origin = originToken?.chainName;
  const destination = destinationToken?.chainName;

  return (
    <div className="max-h-12 overflow-hidden sm:max-h-10">
      {origin && <ChainWalletWarning origin={origin} />}
      {origin && destination && (
        <ChainConnectionWarning origin={origin} destination={destination} />
      )}
      {origin && <WalletConnectionWarning origin={origin} />}
    </div>
  );
}

function RouteSelector({
  routes,
  selectedIndex,
  setSelectedIndex,
  destinationToken,
}: {
  routes: AugmentedRoute[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  destinationToken: UnifiedToken | undefined;
}) {
  if (routes.length <= 1 || !destinationToken) return null;

  return (
    <div className="mb-2 flex gap-1 overflow-x-auto px-1">
      {routes.map((route, index) => {
        const isSelected = index === selectedIndex;
        const output = formatDisplayAmount(BigInt(route.raw.output), destinationToken.decimals);
        return (
          <button
            key={index}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className={`shrink-0 rounded border px-2 py-1 text-left text-xs transition-colors ${
              isSelected
                ? 'border-gray-900 bg-gray-900 text-white dark:border-primary-300 dark:bg-primary-300 dark:text-background'
                : 'border-gray-300 text-gray-500 hover:bg-gray-100 dark:border-primary-300/25 dark:text-foreground-secondary dark:hover:bg-primary-300/[0.18]'
            }`}
          >
            <span>Route {index + 1}</span>
            <span className="ml-1 opacity-80">{output}</span>
          </button>
        );
      })}
    </div>
  );
}

function BridgeFeeSummary({ quote }: { quote: ExactInputBridgeTransferQuote | undefined }) {
  const fees = [
    { label: 'Gas', amount: quote?.interchainQuote },
    { label: 'Bridge', amount: quote?.tokenFeeQuote },
  ].filter((fee) => fee.amount && fee.amount.amount > 0n);

  if (!fees.length) return null;

  return (
    <div className="mb-2 rounded border border-gray-300/60 px-2 py-1.5 text-xs text-gray-500 dark:border-primary-300/25 dark:text-foreground-secondary">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span>Fees</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {fees.map((fee) => (
          <span
            key={fee.label}
            className="rounded border border-gray-300/70 px-1.5 py-0.5 dark:border-primary-300/25"
          >
            {fee.label}: {fee.amount!.getDecimalFormattedAmount().toFixed(8)}{' '}
            {fee.amount!.token.symbol}
          </span>
        ))}
      </div>
    </div>
  );
}

function SwapFeeSummary({ route }: { route: AugmentedRoute | undefined }) {
  const tokenMap = useSwapTokenByKeyMap();
  const { prices } = useSwapTokenPrices();
  const components = useMemo(() => route?.feeBreakdown.components ?? [], [route]);
  const totalUsd = useMemo(
    () => getTotalFeeUsd(components, tokenMap, prices),
    [components, prices, tokenMap],
  );

  if (!components.length) return null;

  return (
    <div className="mb-2 rounded border border-gray-300/60 px-2 py-1.5 text-xs text-gray-500 dark:border-primary-300/25 dark:text-foreground-secondary">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span>Fees</span>
        <span>{totalUsd == null ? '—' : formatUsd(totalUsd)}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {components.map((component, index) => {
          const token = tokenMap.get(
            `${component.chainId}-${component.tokenAddress.toLowerCase()}`,
          );
          const label = component.category === 'igp' ? 'Gas' : 'Bridge';
          return (
            <span
              key={`${component.category}-${component.chainId}-${component.tokenAddress}-${index}`}
              className="rounded border border-gray-300/70 px-1.5 py-0.5 dark:border-primary-300/25"
            >
              {label}: {formatFeeAmount(component.amount, token?.decimals ?? 18)}{' '}
              {token?.symbol ?? 'token'}
            </span>
          );
        })}
      </div>
    </div>
  );
}

const SLIPPAGE_OPTIONS = [50, 100, 300];

function SlippageControl() {
  const { values, setFieldValue } = useFormikContext<UnifiedFormValues>();

  return (
    <div className="flex items-center gap-1">
      <span>Slippage</span>
      <div className="flex overflow-hidden rounded border border-gray-300 bg-white dark:border-primary-300/30 dark:bg-transparent">
        {SLIPPAGE_OPTIONS.map((slippageBps) => {
          const isSelected = values.slippageBps === slippageBps;
          return (
            <button
              key={slippageBps}
              type="button"
              onClick={() => setFieldValue('slippageBps', slippageBps)}
              className={`px-1.5 py-0.5 text-[11px] leading-4 transition-colors ${
                isSelected
                  ? 'bg-gray-900 text-white dark:bg-primary-300 dark:text-background'
                  : 'text-gray-500 hover:bg-gray-100 dark:text-foreground-secondary dark:hover:bg-primary-300/[0.18]'
              }`}
            >
              {slippageBps / 100}%
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OriginTokenCard({
  token,
  destinationToken,
  tokenMap,
  engineEnabled,
  routeMode,
}: {
  token: UnifiedToken | undefined;
  destinationToken: UnifiedToken | undefined;
  tokenMap: Map<string, UnifiedToken>;
  engineEnabled: boolean;
  routeMode: UnifiedRouteMode | null;
}) {
  const { values, setFieldValue } = useFormikContext<UnifiedFormValues>();
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();
  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);
  const bridgeMax = useMutation({
    mutationFn: getExactInputBridgeMaxAmount,
  });
  const { balance: bridgeBalance } = useOriginBalance(token?.bridgeToken);
  const { data: swapBalance, isLoading: isSwapBalanceLoading } = useSwapTokenBalance(
    token?.swapToken,
  );
  const balanceLabel =
    routeMode === UnifiedRouteMode.Swap && token?.swapToken
      ? swapBalance == null
        ? '0.00'
        : `${formatSwapBalance(swapBalance, token.swapToken.decimals)} ${token.symbol}`
      : bridgeBalance
        ? `${bridgeBalance.getDecimalFormattedAmount().toFixed(4)} ${token?.symbol}`
        : '0.00';

  const setMax = async () => {
    if (routeMode === UnifiedRouteMode.Swap && token?.swapToken && swapBalance != null) {
      setFieldValue('amount', formatSwapBalance(swapBalance, token.swapToken.decimals));
      return;
    }
    if (routeMode === UnifiedRouteMode.Bridge && bridgeBalance && destinationToken?.bridgeToken) {
      const { address, publicKey } = getAccountAddressAndPubKey(
        multiProvider,
        bridgeBalance.token.chainName,
        accounts,
      );
      if (!address) return;
      const { address: connectedDestAddress } = getAccountAddressAndPubKey(
        multiProvider,
        destinationToken.bridgeToken.chainName,
        accounts,
      );
      const recipient = values.recipient || connectedDestAddress || address;
      const maxAmount = await bridgeMax.mutateAsync({
        warpCore,
        balance: bridgeBalance,
        destinationToken: destinationToken.bridgeToken,
        recipient,
        sender: address,
        senderPubKey: await publicKey,
      });
      if (!maxAmount) return;
      setFieldValue(
        'amount',
        new BigNumber(maxAmount.getDecimalFormattedAmount()).toFixed(6, BigNumber.ROUND_FLOOR),
      );
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <WalletDropdown chainName={token?.chainName} selectionMode="origin" />
        <ImportTokenButton token={token?.bridgeToken} />
      </div>
      <div className="transfer-chain-field rounded-[7px] border border-gray-400/25 bg-white p-3 shadow-input dark:border-primary-300/[0.18] dark:bg-transparent dark:shadow-none">
        <TokenSelectField
          name="originTokenKey"
          selectionMode="origin"
          tokenMap={tokenMap}
          engineEnabled={engineEnabled}
        />
        <div className="transfer-divider my-2.5 h-px bg-primary-50 dark:bg-primary-300/[0.22]" />
        <div className="flex items-center justify-between gap-2">
          <TextField
            name="amount"
            placeholder="0"
            type="number"
            step="any"
            min="0"
            className="transfer-text-input w-full flex-1 border-none bg-transparent font-secondary text-xl font-normal text-gray-900 outline-none placeholder:text-gray-900 dark:text-foreground-primary dark:placeholder:text-foreground-secondary"
          />
          <button
            type="button"
            onClick={setMax}
            disabled={!token || isSwapBalanceLoading || bridgeMax.isPending}
            className="transfer-max-btn rounded border border-gray-300 px-2 py-0.5 font-secondary text-sm text-gray-450 transition-colors hover:border-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bridgeMax.isPending ? '...' : 'Max'}
          </button>
        </div>
        <div className="transfer-balance mt-1 flex items-center justify-between text-xs leading-[18px] text-gray-450">
          <span>$0.00</span>
          <span>Balance: {balanceLabel}</span>
        </div>
      </div>
    </div>
  );
}

function DestinationTokenCard({
  token,
  tokenMap,
  engineEnabled,
  routeMode,
  bestRoute,
  bridgeQuote,
  isQuoteLoading,
}: {
  token: UnifiedToken | undefined;
  tokenMap: Map<string, UnifiedToken>;
  engineEnabled: boolean;
  routeMode: UnifiedRouteMode | null;
  bestRoute: AugmentedRoute | undefined;
  bridgeQuote: ExactInputBridgeTransferQuote | undefined;
  isQuoteLoading: boolean;
}) {
  const output = useMemo(() => {
    if (!token) return '';
    if (routeMode === UnifiedRouteMode.Bridge && bridgeQuote) {
      return formatDisplayAmount(bridgeQuote.transferAmount.amount, token.decimals);
    }
    if (routeMode !== UnifiedRouteMode.Swap || !bestRoute) return '';
    try {
      return formatDisplayAmount(BigInt(bestRoute.raw.output), token.decimals);
    } catch {
      return '';
    }
  }, [bestRoute, bridgeQuote, routeMode, token]);
  const { values, setFieldValue } = useFormikContext<UnifiedFormValues>();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <WalletDropdown
          chainName={token?.chainName}
          selectionMode="destination"
          recipient={values.recipient}
          onRecipientChange={(addr: string) => setFieldValue('recipient', addr)}
        />
        <ImportTokenButton token={token?.bridgeToken} />
      </div>
      <div className="transfer-chain-field rounded-[7px] border border-gray-400/25 bg-white p-3 shadow-input dark:border-primary-300/[0.18] dark:bg-transparent dark:shadow-none">
        <TokenSelectField
          name="destinationTokenKey"
          selectionMode="destination"
          tokenMap={tokenMap}
          engineEnabled={engineEnabled}
        />
        <div className="transfer-divider my-2.5 h-px bg-primary-50 dark:bg-primary-300/[0.22]" />
        <input
          type="text"
          readOnly
          placeholder={isQuoteLoading ? '…' : '0'}
          value={output}
          className="transfer-text-output w-full flex-1 cursor-not-allowed border-none bg-transparent font-secondary text-xl font-normal text-gray-900 outline-none placeholder:text-gray-400 dark:text-foreground-primary dark:placeholder:text-foreground-secondary"
        />
      </div>
    </div>
  );
}

async function submitBridge({
  values,
  originToken,
  destinationToken,
  recipient,
  sender,
  bridgeTransfer,
}: {
  values: UnifiedFormValues;
  originToken: UnifiedToken | undefined;
  destinationToken: UnifiedToken | undefined;
  recipient: string;
  sender: string | undefined;
  bridgeTransfer: ReturnType<typeof useTokenTransfer>;
}) {
  if (!originToken?.bridgeToken || !destinationToken?.bridgeToken || !recipient) return;
  const warpCore = useStore.getState().warpCore;
  const inputAmount = BigInt(toWei(values.amount, originToken.bridgeToken.decimals));
  const quote = await getExactInputBridgeTransferQuote({
    warpCore,
    originToken: new Token(originToken.bridgeToken),
    destinationToken: destinationToken.bridgeToken,
    inputAmount,
    recipient,
    sender,
  });
  const transferValues = {
    originTokenKey: getBridgeTokenKey(quote.routeToken),
    destinationTokenKey: getBridgeTokenKey(destinationToken.bridgeToken),
    amount: fromWei(quote.transferAmount.amount, quote.routeToken.decimals),
    recipient,
  };
  await bridgeTransfer.triggerTransactions(transferValues, quote.routeToken, null);
}

export async function validateUnifiedBridgeTransfer({
  warpCore,
  bridgeTokenMap,
  collateralGroups,
  values,
  originToken,
  destinationToken,
  recipient,
  sender,
  accounts,
  routerAddressesByChainMap,
}: {
  warpCore: Parameters<typeof validateBridgeTransferForm>[0];
  bridgeTokenMap: Parameters<typeof validateBridgeTransferForm>[1];
  collateralGroups: Parameters<typeof validateBridgeTransferForm>[2];
  values: UnifiedFormValues;
  originToken: UnifiedToken | undefined;
  destinationToken: UnifiedToken | undefined;
  recipient: string;
  sender: string | undefined;
  accounts: Parameters<typeof validateBridgeTransferForm>[4];
  routerAddressesByChainMap: Parameters<typeof validateBridgeTransferForm>[5];
}): Promise<Record<string, string> | null> {
  if (!originToken?.bridgeToken) return { originTokenKey: 'Origin token is required' };
  if (!destinationToken?.bridgeToken) {
    return { destinationTokenKey: 'Destination token is required' };
  }
  if (!recipient) return { recipient: 'Invalid recipient' };

  let quote: ExactInputBridgeTransferQuote;
  try {
    quote = await getExactInputBridgeTransferQuote({
      warpCore,
      originToken: new Token(originToken.bridgeToken),
      destinationToken: destinationToken.bridgeToken,
      inputAmount: BigInt(toWei(values.amount, originToken.bridgeToken.decimals)),
      recipient,
      sender,
    });
  } catch (error) {
    return { form: errorToString(error, 40) };
  }

  const [errors] = await validateBridgeTransferForm(
    warpCore,
    bridgeTokenMap,
    collateralGroups,
    {
      originTokenKey: getBridgeTokenKey(quote.routeToken),
      destinationTokenKey: getBridgeTokenKey(destinationToken.bridgeToken),
      amount: fromWei(quote.transferAmount.amount, quote.routeToken.decimals),
      recipient,
    },
    accounts,
    routerAddressesByChainMap,
  );
  return errors;
}

function useBridgeExactInputQuote({
  routeMode,
  originToken,
  destinationToken,
  amount,
  recipient,
  sender,
}: {
  routeMode: UnifiedRouteMode | null;
  originToken: UnifiedToken | undefined;
  destinationToken: UnifiedToken | undefined;
  amount: string;
  recipient: string;
  sender: string | undefined;
}) {
  const warpCore = useWarpCore();
  const debouncedAmount = useDebounce(amount, 500);
  const isAmountValid =
    !!debouncedAmount &&
    new BigNumber(debouncedAmount).isFinite() &&
    new BigNumber(debouncedAmount).gt(0);
  const enabled = !!(
    routeMode === UnifiedRouteMode.Bridge &&
    originToken?.bridgeToken &&
    destinationToken?.bridgeToken &&
    recipient &&
    isAmountValid
  );

  return useQuery({
    queryKey: [
      'unifiedBridgeExactInputQuote',
      originToken?.key,
      destinationToken?.key,
      debouncedAmount,
      recipient,
      sender,
    ],
    queryFn: () =>
      getExactInputBridgeTransferQuote({
        warpCore,
        originToken: new Token(originToken!.bridgeToken!),
        destinationToken: destinationToken!.bridgeToken!,
        inputAmount: BigInt(toWei(debouncedAmount, originToken!.bridgeToken!.decimals)),
        recipient,
        sender,
      }),
    enabled,
    refetchInterval: 30_000,
  });
}

async function submitSwap({
  values,
  bestRoute,
  originToken,
  destinationToken,
  sender,
  recipient,
  chains,
  multiProvider,
  approvalPending,
  quoteExpiresAt,
  universalRouter,
  amountAtomic,
  swap,
  setErrors,
}: {
  values: Parameters<typeof validateSwapForm>[0]['values'];
  bestRoute: AugmentedRoute | undefined;
  originToken: UnifiedToken | undefined;
  destinationToken: UnifiedToken | undefined;
  sender: string | undefined;
  recipient: string;
  chains: Parameters<typeof validateSwapForm>[0]['chains'];
  multiProvider: Parameters<typeof validateSwapForm>[0]['multiProvider'];
  approvalPending: boolean;
  quoteExpiresAt: number | undefined;
  universalRouter: Address | undefined;
  amountAtomic: bigint | undefined;
  swap: ReturnType<typeof useSwap>;
  setErrors: (errors: Record<string, string>) => void;
}) {
  const srcToken = originToken?.swapToken;
  const dstToken = destinationToken?.swapToken;
  if (!srcToken || !dstToken || !bestRoute || !sender || !values.srcChain || !values.dstChain) {
    return;
  }

  const validationResult = await validateSwapForm({
    values,
    bestRoute,
    srcToken,
    dstToken,
    sender,
    effectiveRecipient: recipient,
    chains,
    multiProvider,
    approvalPending,
    quoteExpiresAt,
  });
  if (validationResult) {
    setErrors(validationResult as Record<string, string>);
    return;
  }

  const timestamp = Date.now();
  const initialStep = bestRoute.raw.steps[0];
  const finalStep = bestRoute.raw.steps[bestRoute.raw.steps.length - 1];
  const destinationSwapStep = bestRoute.raw.steps.find(
    (step): step is Extract<(typeof bestRoute.raw.steps)[number], { type: 'swap' }> =>
      step.type === 'swap' && step.chain === values.dstChain,
  );
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
    recipient,
    destinationOutcome:
      bestRoute.raw.callCommitment && destinationSwapStep
        ? {
            bridgeToken: destinationSwapStep.tokenIn,
            dstToken: destinationSwapStep.tokenOut,
          }
        : undefined,
  };
  const transactionId = useStore.getState().addSwapTransaction(item);
  useStore.getState().setSelectedTransactionId(transactionId);
  useStore.getState().setActiveSwapTransactionId(transactionId);
  useStore.getState().setSwapLoading(true);

  try {
    await swap.execute({
      transactionId,
      route: bestRoute,
      srcChainId: values.srcChain,
      dstChainId: values.dstChain,
      srcToken: srcToken.address,
      dstToken: dstToken.address,
      sender,
      recipient,
      spender: universalRouter,
      approvalAmount: amountAtomic,
      isNative: srcToken.isNative,
    });
  } catch {
    const cur = useStore
      .getState()
      .transactionHistory.find((historyItem) => historyItem.id === transactionId);
    if (
      cur?.type === TransactionHistoryItemType.Swap &&
      !FinalSwapStatuses.includes(cur.data.status)
    ) {
      useStore.getState().updateSwapTransactionStatus(transactionId, SwapStatus.Failed);
    }
  } finally {
    useStore.getState().setActiveSwapTransactionId(null);
    useStore.getState().setSwapLoading(false);
  }
}
