import { Token } from '@hyperlane-xyz/sdk';
import { fromWei, toWei } from '@hyperlane-xyz/utils';
import { useDebounce } from '@hyperlane-xyz/widgets';
import { useAccountAddressForChain } from '@hyperlane-xyz/widgets/walletIntegrations/multiProtocol';
import { useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import { Form, Formik, useFormikContext } from 'formik';
import { useMemo, useState } from 'react';
import { type Address } from 'viem';

import { SolidButton } from '../../components/buttons/SolidButton';
import { SwapIcon } from '../../components/icons/SwapIcon';
import { TextField } from '../../components/input/TextField';
import { TransferSection } from '../../components/layout/TransferSection';
import { config } from '../../consts/config';
import { formatDisplayAmount } from '../../utils/amount';
import { useChains } from '../api/hooks';
import { useOriginBalance } from '../balances/hooks';
import { useMultiProvider } from '../chains/hooks';
import { TransactionHistoryItemType, useStore } from '../store';
import { ApprovalPhase, useApprovalStatus } from '../swap/approval';
import { useTokenBalance as useSwapTokenBalance } from '../swap/balances/hooks';
import { formatBalance as formatSwapBalance } from '../swap/balances/utils';
import {
  FinalSwapStatuses,
  SwapStatus,
  type AugmentedRoute,
  type SwapHistoryItem,
} from '../swap/types';
import { useQuote } from '../swap/useQuote';
import { useSwap } from '../swap/useSwap';
import { validateSwapForm } from '../swap/validate';
import { useCollateralGroups, useWarpCore } from '../tokens/hooks';
import { getTokenKey as getBridgeTokenKey } from '../tokens/utils';
import { useTokenTransfer } from '../transfer/useTokenTransfer';
import { shouldClearAddress } from '../transfer/utils';
import { WalletDropdown } from '../wallet/WalletDropdown';
import {
  getExactInputBridgeTransferQuote,
  type ExactInputBridgeTransferQuote,
} from './bridgeExactInput';
import { useUnifiedTokenByKeyMap, useUnifiedTokens } from './tokens/hooks';
import { getUnifiedRouteMode, UnifiedRouteMode } from './tokens/routes';
import { TokenSelectField } from './tokens/TokenSelectField';
import type { UnifiedToken } from './tokens/types';
import type { UnifiedFormValues } from './types';

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
    const origin = tokens[0];
    const destination = tokens.find(
      (token) =>
        origin &&
        token.chainName !== origin.chainName &&
        getUnifiedRouteMode({
          originToken: origin,
          destinationToken: token,
          collateralGroups,
          engineEnabled,
        }),
    );

    return {
      originTokenKey: origin?.key,
      destinationTokenKey: destination?.key,
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
  const { values, setValues, setErrors } = useFormikContext<UnifiedFormValues>();
  const multiProvider = useMultiProvider();
  const collateralGroups = useCollateralGroups();
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
  const bestRoute = routes[0];

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

  const onSwapTokens = () => {
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

  const onSubmit = async () => {
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

  return (
    <>
      <div className="max-h-12 overflow-hidden sm:max-h-10" />

      <TransferSection label="Send">
        <OriginTokenCard
          token={originToken}
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
        {!engineEnabled && <span>Bridge only</span>}
      </div>

      <SolidButton
        type="button"
        color="accent"
        onClick={onSubmit}
        disabled={!routeMode || isSubmitting || (routeMode === UnifiedRouteMode.Swap && !bestRoute)}
        className="mb-4 w-full px-3 py-2.5 font-secondary text-xl text-cream-100"
      >
        {buttonText}
      </SolidButton>
    </>
  );
}

function OriginTokenCard({
  token,
  tokenMap,
  engineEnabled,
  routeMode,
}: {
  token: UnifiedToken | undefined;
  tokenMap: Map<string, UnifiedToken>;
  engineEnabled: boolean;
  routeMode: UnifiedRouteMode | null;
}) {
  const { setFieldValue } = useFormikContext<UnifiedFormValues>();
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

  const setMax = () => {
    if (routeMode === UnifiedRouteMode.Swap && token?.swapToken && swapBalance != null) {
      setFieldValue('amount', formatSwapBalance(swapBalance, token.swapToken.decimals));
      return;
    }
    if (bridgeBalance) {
      setFieldValue(
        'amount',
        new BigNumber(bridgeBalance.getDecimalFormattedAmount()).toFixed(6, BigNumber.ROUND_FLOOR),
      );
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <WalletDropdown chainName={token?.chainName} selectionMode="origin" />
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
            disabled={!token || isSwapBalanceLoading}
            className="transfer-max-btn rounded border border-gray-300 px-2 py-0.5 font-secondary text-sm text-gray-450 transition-colors hover:border-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Max
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
