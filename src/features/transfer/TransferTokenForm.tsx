import { Token, TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
import {
  ProtocolType,
  convertToScaledAmount,
  eqAddress,
  errorToString,
  fromWei,
  isNullish,
  isValidAddressEvm,
  objKeys,
  toWei,
} from '@hyperlane-xyz/utils';
import {
  AccountInfo,
  ChevronIcon,
  PlusIcon,
  SpinnerIcon,
  getAccountAddressAndPubKey,
  useAccountAddressForChain,
  useAccounts,
  useModal,
} from '@hyperlane-xyz/widgets';
import BigNumber from 'bignumber.js';
import { Form, Formik, useFormikContext } from 'formik';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { RecipientWarningBanner } from '../../components/banner/RecipientWarningBanner';
import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { SolidButton } from '../../components/buttons/SolidButton';
import { SwapIcon } from '../../components/icons/SwapIcon';
// import { TextField } from '../../components/input/TextField';
import { WARP_QUERY_PARAMS } from '../../consts/args';
import { config } from '../../consts/config';
import { Color } from '../../styles/Color';
import { logger } from '../../utils/logger';
import { updateQueryParams } from '../../utils/queryParams';
import { trackTransactionFailedEvent } from '../analytics/utils';
import { ChainConnectionWarning } from '../chains/ChainConnectionWarning';
import { ChainWalletWarning } from '../chains/ChainWalletWarning';
import { useChainDisplayName, useMultiProvider } from '../chains/hooks';
import { isMultiCollateralLimitExceeded } from '../limits/utils';
import { useIsAccountSanctioned } from '../sanctions/hooks/useIsAccountSanctioned';
import { useStore } from '../store';
// import { SelectOrInputTokenIds } from '../tokens/SelectOrInputTokenIds';
import { TokenSelectField } from '../tokens/TokenSelectField';
import { useIsApproveRequired } from '../tokens/approval';
import {
  getDestinationNativeBalance,
  useDestinationBalance,
  useOriginBalance,
} from '../tokens/balances';
import {
  getInitialTokenKeys,
  getTokenByKey,
  useAddToken,
  useCollateralGroups,
  useTokens,
  useWarpCore,
} from '../tokens/hooks';
import { useTokenPrice } from '../tokens/useTokenPrice';
import { checkTokenHasRoute, findRouteToken } from '../tokens/utils';
import { WalletConnectionWarning } from '../wallet/WalletConnectionWarning';
import { FeeSectionButton } from './FeeSectionButton';
import { RecipientConfirmationModal } from './RecipientConfirmationModal';
import { TransferSection } from './TransferSection';
import { getInterchainQuote, getLowestFeeTransferToken, getTotalFee } from './fees';
import { useFetchMaxAmount } from './maxAmount';
import { TransferFormValues } from './types';
// import { useRecipientBalanceWatcher } from './useBalanceWatcher';
import { useFeeQuotes } from './useFeeQuotes';
import { useTokenTransfer } from './useTokenTransfer';
import { isSmartContract } from './utils';

export function TransferTokenForm() {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();
  const tokens = useTokens();
  const collateralGroups = useCollateralGroups();

  const { setOriginChainName, routerAddressesByChainMap } = useStore((s) => ({
    setOriginChainName: s.setOriginChainName,
    routerAddressesByChainMap: s.routerAddressesByChainMap,
  }));

  const initialValues = useFormInitialValues();
  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);

  // Flag for if form is in input vs review mode
  const [isReview, setIsReview] = useState(false);
  // Flag for check current type of token (setter used by TokenSelectField)
  const [, setIsNft] = useState(false);
  // This state is used for when the formik token is different from
  // the token with highest collateral in a multi-collateral token setup
  const [routeOverrideToken, setRouteTokenOverride] = useState<Token | null>(null);
  // Modal for confirming address
  const {
    open: openConfirmationModal,
    close: closeConfirmationModal,
    isOpen: isConfirmationModalOpen,
  } = useModal();

  const validate = async (values: TransferFormValues) => {
    const [result, overrideToken] = await validateForm(
      warpCore,
      tokens,
      collateralGroups,
      values,
      accounts,
      routerAddressesByChainMap,
    );

    trackTransactionFailedEvent(result, warpCore, values, accounts, overrideToken);

    // Unless this is done, the review and the transfer would contain
    // the selected token rather than collateral with highest balance
    setRouteTokenOverride(overrideToken);
    return result;
  };

  const onSubmitForm = async (values: TransferFormValues) => {
    const originToken = getTokenByKey(tokens, values.originTokenKey);
    const destinationToken = getTokenByKey(tokens, values.destinationTokenKey);
    if (!originToken || !destinationToken) return;

    logger.debug(
      'Checking destination native balance for:',
      destinationToken.chainName,
      values.recipient,
    );
    const balance = await getDestinationNativeBalance(multiProvider, {
      destination: destinationToken.chainName,
      recipient: values.recipient,
    });
    if (isNullish(balance)) return;
    else if (balance > 0n) {
      logger.debug('Reviewing transfer form values');
      setIsReview(true);
    } else {
      logger.debug('Recipient has no balance on destination. Confirming address.');
      openConfirmationModal();
    }
  };

  // Update origin chain name in store when origin token changes
  useEffect(() => {
    const originToken = getTokenByKey(tokens, initialValues.originTokenKey);
    if (originToken) {
      setOriginChainName(originToken.chainName);
    }
  }, [initialValues.originTokenKey, tokens, setOriginChainName]);

  return (
    <Formik<TransferFormValues>
      initialValues={initialValues}
      onSubmit={onSubmitForm}
      validate={validate}
      validateOnChange={false}
      validateOnBlur={false}
    >
      {({ isValidating }) => (
        <Form className="flex w-full flex-col items-stretch gap-1.5">
          <WarningBanners />

          {/* Pay Section */}
          <TransferSection label="Pay">
            <TokenAmountBlock
              type="origin"
              tokenFieldName="originTokenKey"
              isReview={isReview}
              setIsNft={setIsNft}
            />
          </TransferSection>

          {/* Swap Button */}
          <SwapTokensButton disabled={isReview} />

          {/* Receive Section */}
          <TransferSection label="Receive">
            <TokenAmountBlock
              type="destination"
              tokenFieldName="destinationTokenKey"
              isReview={isReview}
            />
          </TransferSection>

          {/* <RecipientSection isReview={isReview} /> */}
          <ReviewDetails isReview={isReview} routeOverrideToken={routeOverrideToken} />
          <ButtonSection
            isReview={isReview}
            isValidating={isValidating}
            setIsReview={setIsReview}
            cleanOverrideToken={() => setRouteTokenOverride(null)}
            routeOverrideToken={routeOverrideToken}
          />
          <RecipientConfirmationModal
            isOpen={isConfirmationModalOpen}
            close={closeConfirmationModal}
            onConfirm={() => setIsReview(true)}
          />
        </Form>
      )}
    </Formik>
  );
}

type TokenAmountBlockProps = {
  type: 'origin' | 'destination';
  tokenFieldName: string;
  isReview: boolean;
  setIsNft?: (b: boolean) => void;
};

const USER_REJECTED_ERROR = 'User rejected';

function TokenAmountBlock({ type, tokenFieldName, isReview, setIsNft }: TokenAmountBlockProps) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const tokens = useTokens();
  const multiProvider = useMultiProvider();
  const isOrigin = type === 'origin';

  const originToken = getTokenByKey(tokens, values.originTokenKey);
  const destinationToken = getTokenByKey(tokens, values.destinationTokenKey);
  const currentToken = isOrigin ? originToken : destinationToken;

  // Get wallet addresses for both chains
  const destWalletAddress = useAccountAddressForChain(multiProvider, destinationToken?.chainName);

  const { balance: originBalance } = useOriginBalance(values, originToken);
  const { balance: destBalance } = useDestinationBalance(destWalletAddress, destinationToken);
  const balance = isOrigin ? originBalance : destBalance;

  const { tokenPrice, isLoading: isPriceLoading } = useTokenPrice(values);

  // Import token to wallet functionality
  const { addToken, canAddAsset, isLoading: isAddingToken } = useAddToken(currentToken);
  const onAddToken = useCallback(async () => {
    try {
      await addToken();
    } catch (error: any) {
      const errorDetails = error.message || error.toString();
      if (!errorDetails.includes(USER_REJECTED_ERROR)) toast.error(errorDetails);
      logger.debug(error);
    }
  }, [addToken]);

  const amount = parseFloat(values.amount);
  const totalTokenPrice = !isNullish(tokenPrice) && !isNaN(amount) ? amount * tokenPrice : 0;
  const shouldShowPrice = totalTokenPrice >= 0.01;

  return (
    <div>
      {/* Header Row: Wallet dropdown + Import Token / Advanced Settings */}
      <div className="mb-3 flex items-center justify-between">
        <button type="button" className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-gray-600">0x32...2088</span>
          <ChevronIcon width={10} height={6} direction="s" className="text-gray-400" />
        </button>
        {canAddAsset && (
          <button
            type="button"
            className="flex items-center text-sm text-primary-500 hover:text-primary-600 disabled:opacity-50 [&_path]:fill-primary-500 [&_path]:hover:fill-primary-600"
            onClick={onAddToken}
            disabled={isAddingToken}
          >
            <PlusIcon width={18} height={18} className="-mr-0.5" />
            <span>Import token</span>
          </button>
        )}
      </div>

      {/* White box wrapper for token selector and amount */}
      <div className="rounded-[7px] border border-gray-400/50 bg-white p-4 shadow-input">
        {/* Token Selector */}
        <TokenSelectField
          name={tokenFieldName}
          selectionMode={isOrigin ? 'origin' : 'destination'}
          disabled={isReview}
          setIsNft={setIsNft}
          showLabel={false}
        />

        {/* Separator */}
        <div className="my-4 h-px bg-primary-50" />

        {isOrigin ? (
          /* Amount Section for Origin */
          <>
            <div className="flex items-start justify-between">
              <input
                name="amount"
                value={values.amount}
                onChange={(e) => setFieldValue('amount', e.target.value)}
                placeholder="0.00"
                className="w-full flex-1 border-none bg-transparent p-0 font-secondary text-[26px] font-normal leading-[34px] text-plum-900 outline-none placeholder:text-gray-300"
                type="number"
                step="any"
                disabled={isReview}
              />
              <MaxButton balance={balance} disabled={isReview} />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs leading-[18px] text-gray-450">
              <span>
                {shouldShowPrice && !isPriceLoading ? (
                  <>
                    $
                    {totalTokenPrice.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </>
                ) : (
                  '$0.00'
                )}
              </span>
              <TokenBalance label="Balance" balance={balance} />
            </div>
          </>
        ) : (
          /* Remote Balance for Destination */
          <TokenBalance label="Remote Balance" balance={balance} />
        )}
      </div>
    </div>
  );
}

function SwapTokensButton({ disabled }: { disabled?: boolean }) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const tokens = useTokens();

  const onSwap = useCallback(() => {
    if (disabled) return;

    const { originTokenKey, destinationTokenKey } = values;
    const originToken = getTokenByKey(tokens, originTokenKey);
    const destToken = getTokenByKey(tokens, destinationTokenKey);

    // Swap the token keys
    setFieldValue('originTokenKey', destinationTokenKey);
    setFieldValue('destinationTokenKey', originTokenKey);
    // Clear the amount when swapping
    setFieldValue('amount', '');

    // Update URL params
    if (originToken && destToken) {
      updateQueryParams({
        [WARP_QUERY_PARAMS.ORIGIN]: destToken.chainName,
        [WARP_QUERY_PARAMS.ORIGIN_TOKEN]: destToken.symbol,
        [WARP_QUERY_PARAMS.DESTINATION]: originToken.chainName,
        [WARP_QUERY_PARAMS.DESTINATION_TOKEN]: originToken.symbol,
      });
    }
  }, [disabled, values, tokens, setFieldValue]);

  return (
    <div className="relative z-10 -my-4 flex justify-center">
      <button
        type="button"
        onClick={onSwap}
        disabled={disabled}
        className="group flex h-10 w-10 items-center justify-center rounded border border-gray-400/50 bg-white shadow-button transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <SwapIcon
          width={18}
          height={24}
          className="transition-transform duration-300 group-hover:rotate-180 group-disabled:rotate-0"
        />
      </button>
    </div>
  );
}

// function RecipientSection({ isReview }: { isReview: boolean }) {
//   const { values } = useFormikContext<TransferFormValues>();
//   const tokens = useTokens();
//   const destinationToken = getTokenByKey(tokens, values.destinationTokenKey);

//   const { balance } = useDestinationBalance(values, destinationToken);
//   useRecipientBalanceWatcher(destinationToken?.chainName || '', balance);

//   return (
//     <div className="mt-4">
//       <div className="flex justify-between pr-1">
//         <label htmlFor="recipient" className="block pl-0.5 text-sm text-gray-600">
//           Recipient
//         </label>
//         <TokenBalance label="Recipient balance" balance={balance} />
//       </div>
//       <div className="relative w-full">
//         <TextField
//           name="recipient"
//           placeholder="Recipient address (0x...)"
//           className="w-full"
//           disabled={isReview}
//         />
//         <SelfButton disabled={isReview} destinationChain={destinationToken?.chainName} />
//       </div>
//     </div>
//   );
// }

function TokenBalance({
  label,
  balance,
}: {
  label: string;
  balance: TokenAmount | null | undefined;
}) {
  return (
    <span className="text-xs leading-[18px] text-gray-450">
      {balance ? (
        <>
          {label}: {balance.getDecimalFormattedAmount().toFixed(4)} {balance.token.symbol}
        </>
      ) : (
        <>{label}: 0.00</>
      )}
    </span>
  );
}

function ButtonSection({
  isReview,
  isValidating,
  setIsReview,
  cleanOverrideToken,
  routeOverrideToken,
}: {
  isReview: boolean;
  isValidating: boolean;
  setIsReview: (b: boolean) => void;
  cleanOverrideToken: () => void;
  routeOverrideToken: Token | null;
}) {
  const { values } = useFormikContext<TransferFormValues>();
  const multiProvider = useMultiProvider();
  const tokens = useTokens();
  const originToken = routeOverrideToken || getTokenByKey(tokens, values.originTokenKey);
  const destinationToken = getTokenByKey(tokens, values.destinationTokenKey);
  const chainDisplayName = useChainDisplayName(destinationToken?.chainName || '');
  const isRouteSupported = useIsRouteSupported();

  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);
  const { address: connectedWallet } = getAccountAddressAndPubKey(
    multiProvider,
    originToken?.chainName,
    accounts,
  );

  // Confirming recipient address
  const [{ addressConfirmed, showWarning }, setRecipientInfos] = useState({
    showWarning: false,
    addressConfirmed: true,
  });

  useEffect(() => {
    const checkSameEVMRecipient = async (recipient: string) => {
      if (!connectedWallet || !originToken || !destinationToken) {
        setRecipientInfos({ showWarning: false, addressConfirmed: true });
        return;
      }

      const { protocol: destinationProtocol } = multiProvider.getChainMetadata(
        destinationToken.chainName,
      );
      const { protocol: sourceProtocol } = multiProvider.getChainMetadata(originToken.chainName);

      if (
        sourceProtocol !== ProtocolType.Ethereum ||
        destinationProtocol !== ProtocolType.Ethereum
      ) {
        setRecipientInfos({ showWarning: false, addressConfirmed: true });
        return;
      }

      if (!isValidAddressEvm(recipient)) {
        setRecipientInfos({ showWarning: false, addressConfirmed: true });
        return;
      }

      const { isContract: isSenderSmartContract, error: senderCheckError } = await isSmartContract(
        multiProvider,
        originToken.chainName,
        connectedWallet,
      );

      const { isContract: isRecipientSmartContract, error: recipientCheckError } =
        await isSmartContract(multiProvider, destinationToken.chainName, recipient);

      const isSelfRecipient = eqAddress(recipient, connectedWallet);

      if (senderCheckError || recipientCheckError) {
        toast.error(senderCheckError || recipientCheckError);
        setRecipientInfos({ addressConfirmed: true, showWarning: false });
        return;
      }

      if (isSelfRecipient && isSenderSmartContract && !isRecipientSmartContract) {
        const msg = `The recipient address is the same as the connected wallet, but it does not exist as a smart contract on ${chainDisplayName}.`;
        logger.warn(msg);
        setRecipientInfos({ showWarning: true, addressConfirmed: false });
      } else {
        setRecipientInfos({ showWarning: false, addressConfirmed: true });
      }
    };
    checkSameEVMRecipient(values.recipient);
  }, [
    values.recipient,
    connectedWallet,
    multiProvider,
    originToken,
    destinationToken,
    chainDisplayName,
  ]);

  const isSanctioned = useIsAccountSanctioned();

  const onDoneTransactions = () => {
    setIsReview(false);
    cleanOverrideToken();
  };
  const { triggerTransactions } = useTokenTransfer(onDoneTransactions);

  const { setTransferLoading } = useStore((s) => ({
    setTransferLoading: s.setTransferLoading,
  }));

  const triggerTransactionsHandler = async () => {
    if (isSanctioned || !originToken || !destinationToken) return;
    setIsReview(false);
    setTransferLoading(true);

    await triggerTransactions(values, routeOverrideToken);
    setTransferLoading(false);
  };

  const onEdit = () => {
    setIsReview(false);
    cleanOverrideToken();
  };

  const text = !isRouteSupported
    ? 'Route is not supported'
    : isValidating
      ? 'Validating...'
      : 'Continue';

  if (!isReview) {
    return (
      <>
        <div
          className={`mt-3 gap-2 bg-amber-400 px-4 text-sm ${
            showWarning ? 'max-h-38 py-2' : 'max-h-0'
          } overflow-hidden transition-all duration-500`}
        >
          <RecipientWarningBanner
            destinationChain={chainDisplayName}
            confirmRecipientHandler={(checked) =>
              setRecipientInfos((state) => ({ ...state, addressConfirmed: checked }))
            }
          />
        </div>

        <ConnectAwareSubmitButton
          disabled={!addressConfirmed || !isRouteSupported}
          chainName={originToken?.chainName || ''}
          text={text}
          classes={`${isReview ? 'mt-4' : 'mt-0'} px-3 py-1.5`}
        />
      </>
    );
  }

  return (
    <>
      <div
        className={`mt-3 gap-2 bg-amber-400 px-4 text-sm ${
          showWarning ? 'max-h-38 py-2' : 'max-h-0'
        } overflow-hidden transition-all duration-500`}
      >
        <RecipientWarningBanner
          destinationChain={chainDisplayName}
          confirmRecipientHandler={(checked) =>
            setRecipientInfos((state) => ({ ...state, addressConfirmed: checked }))
          }
        />
      </div>
      <div className="mt-4 flex items-center justify-between space-x-4">
        <SolidButton
          type="button"
          color="primary"
          onClick={onEdit}
          className="px-6 py-1.5"
          icon={<ChevronIcon direction="w" width={10} height={6} color={Color.white} />}
        >
          <span>Edit</span>
        </SolidButton>
        <SolidButton
          disabled={!addressConfirmed || isSanctioned}
          type="button"
          color="accent"
          onClick={triggerTransactionsHandler}
          className="flex-1 px-3 py-1.5"
        >
          {`Send to ${chainDisplayName}`}
        </SolidButton>
      </div>
    </>
  );
}

function MaxButton({ balance, disabled }: { balance?: TokenAmount; disabled?: boolean }) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { originTokenKey, destinationTokenKey } = values;
  const tokens = useTokens();
  const originToken = getTokenByKey(tokens, originTokenKey);
  const destinationToken = getTokenByKey(tokens, destinationTokenKey);
  const multiProvider = useMultiProvider();
  const { accounts } = useAccounts(multiProvider);
  const { fetchMaxAmount, isLoading } = useFetchMaxAmount();
  const isRouteSupported = useIsRouteSupported();

  const isDisabled = disabled || !isRouteSupported;

  const onClick = async () => {
    if (!balance || !originToken || !destinationToken || isDisabled) return;
    const maxAmount = await fetchMaxAmount({
      balance,
      origin: originToken.chainName,
      destination: destinationToken.chainName,
      accounts,
    });
    if (isNullish(maxAmount)) return;
    const decimalsAmount = maxAmount.getDecimalFormattedAmount();
    const roundedAmount = new BigNumber(decimalsAmount).toFixed(4, BigNumber.ROUND_FLOOR);
    setFieldValue('amount', roundedAmount);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className="rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading ? <SpinnerIcon className="h-4 w-4" /> : 'Max'}
    </button>
  );
}

// function SelfButton({
//   disabled,
//   destinationChain,
// }: {
//   disabled?: boolean;
//   destinationChain?: string;
// }) {
//   const { setFieldValue } = useFormikContext<TransferFormValues>();
//   const multiProvider = useMultiProvider();
//   const chainDisplayName = useChainDisplayName(destinationChain || '');
//   const { accounts } = useAccounts(multiProvider);

//   const onClick = () => {
//     if (disabled || !destinationChain) return;
//     const protocol = multiProvider.tryGetProtocol(destinationChain);
//     if (!protocol) return;
//     const account = accounts[protocol];
//     if (account?.addresses?.[0]?.address) {
//       setFieldValue('recipient', account.addresses[0].address);
//     } else {
//       logger.warn(`No account found for chain ${chainDisplayName}`);
//     }
//   };

//   return (
//     <SolidButton
//       type="button"
//       onClick={onClick}
//       color="primary"
//       disabled={disabled || !destinationChain}
//       className="absolute bottom-1 right-1 top-2.5 px-2 text-xs opacity-90 all:rounded"
//     >
//       Self
//     </SolidButton>
//   );
// }

function ReviewDetails({
  isReview,
  routeOverrideToken,
}: {
  isReview: boolean;
  routeOverrideToken: Token | null;
}) {
  const { values } = useFormikContext<TransferFormValues>();
  const warpCore = useWarpCore();
  const { amount, originTokenKey, destinationTokenKey } = values;
  const tokens = useTokens();
  const originTokenByKey = routeOverrideToken || getTokenByKey(tokens, originTokenKey);
  const destinationTokenByKey = getTokenByKey(tokens, destinationTokenKey);
  // Finding actual token pair for the given tokens
  const originToken =
    destinationTokenByKey && originTokenByKey
      ? findRouteToken(warpCore, originTokenByKey, destinationTokenByKey.chainName)
      : undefined;
  const destinationToken = destinationTokenByKey
    ? originToken?.getConnectionForChain(destinationTokenByKey.chainName)?.token
    : undefined;
  const originTokenSymbol = originToken?.symbol || '';
  const isNft = originToken?.isNft();
  const isRouteSupported = useIsRouteSupported();

  const scaledAmount = useMemo(() => {
    if (!originToken?.scale || !destinationToken?.scale) return null;
    if (!isReview || originToken.scale === destinationToken.scale) return null;

    const amountWei = toWei(amount, originToken.decimals);
    const precisionFactor = 100000;

    const convertedAmount = convertToScaledAmount({
      amount: BigInt(amountWei),
      fromScale: originToken.scale,
      toScale: destinationToken.scale,
      precisionFactor,
    });
    const value = convertedAmount / BigInt(precisionFactor);

    return {
      value: fromWei(value.toString(), originToken.decimals),
      originScale: originToken.scale,
      destinationScale: destinationToken.scale,
    };
  }, [amount, originToken, destinationToken, isReview]);

  const amountWei = isNft ? amount.toString() : toWei(amount, originToken?.decimals);

  const { isLoading: isApproveLoading, isApproveRequired } = useIsApproveRequired(
    originToken,
    amountWei,
    isReview,
  );
  // Only fetch fees if route is supported
  const { isLoading: isQuoteLoading, fees: feeQuotes } = useFeeQuotes(
    values,
    isRouteSupported,
    originToken,
    destinationToken,
    !isReview,
  );

  const isLoading = isApproveLoading || isQuoteLoading;

  const fees = useMemo(() => {
    if (!feeQuotes) return null;

    const interchainQuote = getInterchainQuote(originToken, feeQuotes.interchainQuote);
    const fees = {
      ...feeQuotes,
      interchainQuote: interchainQuote || feeQuotes.interchainQuote,
    };
    const totalFees = getTotalFee({
      ...fees,
      interchainQuote: interchainQuote || fees.interchainQuote,
    })
      .map((fee) => `${fee.getDecimalFormattedAmount().toFixed(8)} ${fee.token.symbol}`)
      .join(', ');

    return {
      ...fees,
      totalFees,
    };
  }, [feeQuotes, originToken]);

  return (
    <>
      {!isReview && <FeeSectionButton visible={!isReview} fees={fees} isLoading={isLoading} />}

      <div
        className={`${
          isReview ? 'max-h-screen duration-1000 ease-in' : 'max-h-0 duration-500'
        } overflow-hidden transition-all`}
      >
        <label className="mt-4 block pl-0.5 text-sm text-gray-600">Transactions</label>
        <div className="mt-1.5 space-y-2 break-all rounded border border-gray-400 bg-gray-150 px-2.5 py-2 text-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <SpinnerIcon className="h-5 w-5" />
            </div>
          ) : (
            <>
              {isApproveRequired && (
                <div>
                  <h4>Transaction 1: Approve Transfer</h4>
                  <div className="ml-1.5 mt-1.5 space-y-1.5 border-l border-gray-300 pl-2 text-xs">
                    <p>{`Router Address: ${originToken?.addressOrDenom}`}</p>
                    {originToken?.collateralAddressOrDenom && (
                      <p>{`Collateral Address: ${originToken.collateralAddressOrDenom}`}</p>
                    )}
                  </div>
                </div>
              )}
              <div>
                <h4>{`Transaction${isApproveRequired ? ' 2' : ''}: Transfer Remote`}</h4>
                <div className="ml-1.5 mt-1.5 space-y-1.5 border-l border-gray-300 pl-2 text-xs">
                  {destinationToken?.addressOrDenom && (
                    <p className="flex">
                      <span className="min-w-[7.5rem]">Remote Token</span>
                      <span>{destinationToken.addressOrDenom}</span>
                    </p>
                  )}

                  <p className="flex">
                    <span className="min-w-[7.5rem]">{isNft ? 'Token ID' : 'Amount'}</span>
                    <span>{`${amount} ${originTokenSymbol}`}</span>
                  </p>
                  {scaledAmount && (
                    <p className="flex">
                      <span className="min-w-[7.5rem]">Received Amount</span>
                      <span>{`${scaledAmount.value} ${originTokenSymbol} (scaled from ${scaledAmount.originScale} to ${scaledAmount.destinationScale})`}</span>
                    </p>
                  )}
                  {fees?.localQuote && fees.localQuote.amount > 0n && (
                    <p className="flex">
                      <span className="min-w-[7.5rem]">Local Gas (est.)</span>
                      <span>{`${fees.localQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${
                        fees.localQuote.token.symbol || ''
                      }`}</span>
                    </p>
                  )}
                  {fees?.interchainQuote && fees.interchainQuote.amount > 0n && (
                    <p className="flex">
                      <span className="min-w-[7.5rem]">Interchain Gas</span>
                      <span>{`${fees.interchainQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${
                        fees.interchainQuote.token.symbol || ''
                      }`}</span>
                    </p>
                  )}
                  {fees?.tokenFeeQuote && fees.tokenFeeQuote.amount > 0n && (
                    <p className="flex">
                      <span className="min-w-[7.5rem]">Token Fee</span>
                      <span>{`${fees.tokenFeeQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${
                        fees.tokenFeeQuote.token.symbol || ''
                      }`}</span>
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function WarningBanners() {
  const { values } = useFormikContext<TransferFormValues>();
  const tokens = useTokens();
  const originToken = getTokenByKey(tokens, values.originTokenKey);
  const destinationToken = getTokenByKey(tokens, values.destinationTokenKey);

  return (
    // Max height to prevent double padding if multiple warnings are visible
    <div className="max-h-10">
      <ChainWalletWarning origin={originToken?.chainName || ''} />
      <ChainConnectionWarning
        origin={originToken?.chainName || ''}
        destination={destinationToken?.chainName || ''}
      />
      <WalletConnectionWarning origin={originToken?.chainName || ''} />
    </div>
  );
}

function useFormInitialValues(): TransferFormValues {
  const warpCore = useWarpCore();
  const tokens = useTokens();

  const { originTokenKey, destinationTokenKey } = getInitialTokenKeys(warpCore, tokens);

  return useMemo(
    () => ({
      originTokenKey,
      destinationTokenKey,
      amount: '',
      recipient: '',
    }),
    [originTokenKey, destinationTokenKey],
  );
}

function useIsRouteSupported(): boolean {
  const { values } = useFormikContext<TransferFormValues>();
  const tokens = useTokens();
  const collateralGroups = useCollateralGroups();
  const originToken = getTokenByKey(tokens, values.originTokenKey);
  const destinationToken = getTokenByKey(tokens, values.destinationTokenKey);

  return useMemo(() => {
    if (!originToken || !destinationToken) return true;
    return checkTokenHasRoute(originToken, destinationToken, collateralGroups);
  }, [originToken, destinationToken, collateralGroups]);
}

const insufficientFundsErrMsg = /insufficient.[funds|lamports]/i;
const emptyAccountErrMsg = /AccountNotFound/i;

async function validateForm(
  warpCore: WarpCore,
  tokens: Token[],
  collateralGroups: Map<string, Token[]>,
  values: TransferFormValues,
  accounts: Record<ProtocolType, AccountInfo>,
  routerAddressesByChainMap: Record<ChainName, Set<string>>,
): Promise<[Record<string, string> | null, Token | null]> {
  // returns a tuple, where first value is validation result
  // and second value is token override
  try {
    const { originTokenKey, destinationTokenKey, amount, recipient } = values;

    // Look up tokens from the unified array
    const token = getTokenByKey(tokens, originTokenKey);
    const destinationToken = getTokenByKey(tokens, destinationTokenKey);

    if (!token) return [{ originTokenKey: 'Origin token is required' }, null];
    if (!destinationToken) return [{ destinationTokenKey: 'Destination token is required' }, null];

    // Early route check using collateral groups - validates origin token can reach destination token
    if (!checkTokenHasRoute(token, destinationToken, collateralGroups)) {
      return [{ destinationTokenKey: 'Route is not supported' }, null];
    }

    const destination = destinationToken.chainName;

    if (
      objKeys(routerAddressesByChainMap).includes(destination) &&
      routerAddressesByChainMap[destination].has(recipient)
    ) {
      return [{ recipient: 'Warp Route address is not valid as recipient' }, null];
    }

    const { address: sender, publicKey: senderPubKey } = getAccountAddressAndPubKey(
      warpCore.multiProvider,
      token.chainName,
      accounts,
    );

    const amountWei = toWei(amount, token.decimals);

    // getLowestFeeTransferToken will find the actual warpCore token that has the route
    // The unified array token may not have the connection due to deduplication
    const transferToken = await getLowestFeeTransferToken(
      warpCore,
      token,
      destinationToken,
      amountWei,
      recipient,
      sender,
    );

    // This should not happen since we already checked the route above, but keep as safety check
    const connection = transferToken.getConnectionForChain(destination);
    if (!connection) {
      return [{ destinationTokenKey: 'Route is not supported' }, null];
    }

    const multiCollateralLimit = isMultiCollateralLimitExceeded(token, destination, amountWei);

    if (multiCollateralLimit) {
      return [
        {
          amount: `Transfer limit is ${fromWei(multiCollateralLimit.toString(), token.decimals)} ${token.symbol}`,
        },
        null,
      ];
    }

    const result = await warpCore.validateTransfer({
      originTokenAmount: transferToken.amount(amountWei),
      destination,
      recipient,
      sender: sender || '',
      senderPubKey: await senderPubKey,
    });

    if (!isNullish(result)) return [result, null];

    if (transferToken.addressOrDenom === token.addressOrDenom) return [null, null];

    return [null, transferToken];
  } catch (error: any) {
    logger.error('Error validating form', error);
    let errorMsg = errorToString(error, 40);
    const fullError = `${errorMsg} ${error.message}`;
    if (insufficientFundsErrMsg.test(fullError) || emptyAccountErrMsg.test(fullError)) {
      errorMsg = 'Insufficient funds for gas fees';
    }
    return [{ form: errorMsg }, null];
  }
}
