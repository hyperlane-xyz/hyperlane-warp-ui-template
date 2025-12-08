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
  SpinnerIcon,
  getAccountAddressAndPubKey,
  useAccounts,
  useModal,
} from '@hyperlane-xyz/widgets';
import BigNumber from 'bignumber.js';
import { Form, Formik, useFormikContext } from 'formik';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { RecipientWarningBanner } from '../../components/banner/RecipientWarningBanner';
import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { SolidButton } from '../../components/buttons/SolidButton';
import { TextField } from '../../components/input/TextField';
import { config } from '../../consts/config';
import { Color } from '../../styles/Color';
import { logger } from '../../utils/logger';
import { trackTransactionFailedEvent } from '../analytics/utils';
import { ChainConnectionWarning } from '../chains/ChainConnectionWarning';
import { ChainWalletWarning } from '../chains/ChainWalletWarning';
import { useChainDisplayName, useMultiProvider } from '../chains/hooks';
import { isMultiCollateralLimitExceeded } from '../limits/utils';
import { useIsAccountSanctioned } from '../sanctions/hooks/useIsAccountSanctioned';
import { useStore } from '../store';
import { SelectOrInputTokenIds } from '../tokens/SelectOrInputTokenIds';
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
  useDestinationTokens,
  useOriginTokens,
  useWarpCore,
} from '../tokens/hooks';
import { useTokenPrice } from '../tokens/useTokenPrice';
import { getTokenKey } from '../tokens/utils';
import { WalletConnectionWarning } from '../wallet/WalletConnectionWarning';
import { FeeSectionButton } from './FeeSectionButton';
import { RecipientConfirmationModal } from './RecipientConfirmationModal';
import { getInterchainQuote, getLowestFeeTransferToken, getTotalFee } from './fees';
import { useFetchMaxAmount } from './maxAmount';
import { TransferFormValues } from './types';
import { useRecipientBalanceWatcher } from './useBalanceWatcher';
import { useFeeQuotes } from './useFeeQuotes';
import { useTokenTransfer } from './useTokenTransfer';
import { isSmartContract } from './utils';

export function TransferTokenForm() {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();
  const originTokens = useOriginTokens();
  const destinationTokens = useDestinationTokens();

  const { setOriginChainName, routerAddressesByChainMap } = useStore((s) => ({
    setOriginChainName: s.setOriginChainName,
    routerAddressesByChainMap: s.routerAddressesByChainMap,
  }));

  const initialValues = useFormInitialValues();
  const { accounts } = useAccounts(multiProvider, config.addressBlacklist);

  // Flag for if form is in input vs review mode
  const [isReview, setIsReview] = useState(false);
  // Flag for check current type of token
  const [isNft, setIsNft] = useState(false);
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
      originTokens,
      destinationTokens,
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
    const originToken = getTokenByKey(originTokens, values.originTokenKey);
    const destinationToken = getTokenByKey(destinationTokens, values.destinationTokenKey);
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
    const originToken = getTokenByKey(originTokens, initialValues.originTokenKey);
    if (originToken) {
      setOriginChainName(originToken.chainName);
    }
  }, [initialValues.originTokenKey, originTokens, setOriginChainName]);

  return (
    <Formik<TransferFormValues>
      initialValues={initialValues}
      onSubmit={onSubmitForm}
      validate={validate}
      validateOnChange={false}
      validateOnBlur={false}
    >
      {({ isValidating }) => (
        <Form className="flex w-full flex-col items-stretch">
          <WarningBanners />
          <TokenSelectSection setIsNft={setIsNft} isReview={isReview} />
          <AmountSection isNft={isNft} isReview={isReview} />
          <RecipientSection isReview={isReview} />
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

function TokenSelectSection({
  setIsNft,
  isReview,
}: {
  setIsNft: (b: boolean) => void;
  isReview: boolean;
}) {
  return (
    <div className="mt-2 space-y-3">
      <TokenSelectField
        name="originTokenKey"
        label="From"
        selectionMode="origin"
        disabled={isReview}
        setIsNft={setIsNft}
      />
      <TokenSelectField
        name="destinationTokenKey"
        label="To"
        selectionMode="destination"
        disabled={isReview}
      />
    </div>
  );
}

function AmountSection({ isNft, isReview }: { isNft: boolean; isReview: boolean }) {
  const { values } = useFormikContext<TransferFormValues>();
  const originTokens = useOriginTokens();
  const originToken = getTokenByKey(originTokens, values.originTokenKey);
  const { balance } = useOriginBalance(values, originToken);
  const { tokenPrice, isLoading } = useTokenPrice(values);

  const amount = parseFloat(values.amount);
  const totalTokenPrice = !isNullish(tokenPrice) && !isNaN(amount) ? amount * tokenPrice : 0;
  const shouldShowPrice = totalTokenPrice >= 0.01;

  return (
    <div className="mt-4">
      <div className="flex justify-between pr-1">
        <label htmlFor="amount" className="block pl-0.5 text-sm text-gray-600">
          Amount
        </label>
        <TokenBalance label="My balance" balance={balance} />
      </div>
      {isNft ? (
        <SelectOrInputTokenIds disabled={isReview} />
      ) : (
        <div className="relative w-full">
          <TextField
            name="amount"
            placeholder="0.00"
            className="w-full"
            type="number"
            step="any"
            disabled={isReview}
          />
          {shouldShowPrice && !isLoading && (
            <div className="absolute bottom-[-18px] left-1 max-w-52 overflow-hidden text-ellipsis whitespace-nowrap text-xxs text-gray-500">
              ≈${totalTokenPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </div>
          )}
          <MaxButton balance={balance} disabled={isReview} />
        </div>
      )}
    </div>
  );
}

function RecipientSection({ isReview }: { isReview: boolean }) {
  const { values } = useFormikContext<TransferFormValues>();
  const destinationTokens = useDestinationTokens();
  const destinationToken = getTokenByKey(destinationTokens, values.destinationTokenKey);

  const { balance } = useDestinationBalance(values, destinationToken);
  useRecipientBalanceWatcher(destinationToken?.chainName || '', balance);

  return (
    <div className="mt-4">
      <div className="flex justify-between pr-1">
        <label htmlFor="recipient" className="block pl-0.5 text-sm text-gray-600">
          Recipient
        </label>
        <TokenBalance label="Recipient balance" balance={balance} />
      </div>
      <div className="relative w-full">
        <TextField
          name="recipient"
          placeholder="Recipient address (0x...)"
          className="w-full"
          disabled={isReview}
        />
        <SelfButton disabled={isReview} destinationChain={destinationToken?.chainName} />
      </div>
    </div>
  );
}

function TokenBalance({
  label,
  balance,
}: {
  label: string;
  balance: TokenAmount | null | undefined;
}) {
  return (
    <div className="text-xs text-gray-500">
      {balance ? (
        <span>
          {label}: {balance.getDecimalFormattedAmount().toFixed(4)} {balance.token.symbol}
        </span>
      ) : null}
    </div>
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
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const multiProvider = useMultiProvider();
  const originTokens = useOriginTokens();
  const destinationTokens = useDestinationTokens();
  const originToken = routeOverrideToken || getTokenByKey(originTokens, values.originTokenKey);
  const destinationToken = getTokenByKey(destinationTokens, values.destinationTokenKey);
  const chainDisplayName = useChainDisplayName(destinationToken?.chainName || '');

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

    // For existing tokens with override applied, update the token key
    if (routeOverrideToken) {
      setFieldValue('originTokenKey', getTokenKey(routeOverrideToken));
    }

    await triggerTransactions(values);
    setTransferLoading(false);
  };

  const onEdit = () => {
    setIsReview(false);
    cleanOverrideToken();
  };

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
          disabled={!addressConfirmed}
          chainName={originToken?.chainName || ''}
          text={isValidating ? 'Validating...' : 'Continue'}
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
  const originTokens = useOriginTokens();
  const destinationTokens = useDestinationTokens();
  const originToken = getTokenByKey(originTokens, originTokenKey);
  const destinationToken = getTokenByKey(destinationTokens, destinationTokenKey);
  const multiProvider = useMultiProvider();
  const { accounts } = useAccounts(multiProvider);
  const { fetchMaxAmount, isLoading } = useFetchMaxAmount();

  const onClick = async () => {
    if (!balance || !originToken || !destinationToken || disabled) return;
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
    <SolidButton
      type="button"
      onClick={onClick}
      color="primary"
      disabled={disabled}
      className="absolute bottom-1 right-1 top-2.5 px-2 text-xs opacity-90 all:rounded"
    >
      {isLoading ? (
        <div className="flex items-center">
          <SpinnerIcon className="h-5 w-5" color="white" />
        </div>
      ) : (
        'Max'
      )}
    </SolidButton>
  );
}

function SelfButton({
  disabled,
  destinationChain,
}: {
  disabled?: boolean;
  destinationChain?: string;
}) {
  const { setFieldValue } = useFormikContext<TransferFormValues>();
  const multiProvider = useMultiProvider();
  const chainDisplayName = useChainDisplayName(destinationChain || '');
  const { accounts } = useAccounts(multiProvider);

  const onClick = () => {
    if (disabled || !destinationChain) return;
    const protocol = multiProvider.tryGetProtocol(destinationChain);
    if (!protocol) return;
    const account = accounts[protocol];
    if (account?.addresses?.[0]?.address) {
      setFieldValue('recipient', account.addresses[0].address);
    } else {
      logger.warn(`No account found for chain ${chainDisplayName}`);
    }
  };

  return (
    <SolidButton
      type="button"
      onClick={onClick}
      color="primary"
      disabled={disabled || !destinationChain}
      className="absolute bottom-1 right-1 top-2.5 px-2 text-xs opacity-90 all:rounded"
    >
      Self
    </SolidButton>
  );
}

function ReviewDetails({
  isReview,
  routeOverrideToken,
}: {
  isReview: boolean;
  routeOverrideToken: Token | null;
}) {
  const { values } = useFormikContext<TransferFormValues>();
  const { amount, originTokenKey, destinationTokenKey } = values;
  const originTokens = useOriginTokens();
  const destinationTokens = useDestinationTokens();
  const originToken = routeOverrideToken || getTokenByKey(originTokens, originTokenKey);
  const destinationToken = getTokenByKey(destinationTokens, destinationTokenKey);
  const originTokenSymbol = originToken?.symbol || '';
  const isNft = originToken?.isNft();

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
  const { isLoading: isQuoteLoading, fees: feeQuotes } = useFeeQuotes(
    values,
    true,
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
  const originTokens = useOriginTokens();
  const destinationTokens = useDestinationTokens();
  const originToken = getTokenByKey(originTokens, values.originTokenKey);
  const destinationToken = getTokenByKey(destinationTokens, values.destinationTokenKey);

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
  const originTokens = useOriginTokens();
  const destinationTokens = useDestinationTokens();

  const { originTokenKey, destinationTokenKey } = getInitialTokenKeys(
    warpCore,
    originTokens,
    destinationTokens,
  );

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

const insufficientFundsErrMsg = /insufficient.[funds|lamports]/i;
const emptyAccountErrMsg = /AccountNotFound/i;

async function validateForm(
  warpCore: WarpCore,
  originTokens: Token[],
  destinationTokens: Token[],
  values: TransferFormValues,
  accounts: Record<ProtocolType, AccountInfo>,
  routerAddressesByChainMap: Record<ChainName, Set<string>>,
): Promise<[Record<string, string> | null, Token | null]> {
  // returns a tuple, where first value is validation result
  // and second value is token override
  try {
    const { originTokenKey, destinationTokenKey, amount, recipient } = values;

    // Look up tokens from their respective arrays
    const token = getTokenByKey(originTokens, originTokenKey);
    const destinationToken = getTokenByKey(destinationTokens, destinationTokenKey);

    if (!token) return [{ originTokenKey: 'Origin token is required' }, null];
    if (!destinationToken) return [{ destinationTokenKey: 'Destination token is required' }, null];

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
    const transferToken = await getLowestFeeTransferToken(
      warpCore,
      token,
      destinationToken,
      amountWei,
      recipient,
      sender,
    );

    // Check if a valid route exists using the SDK method
    const connection = transferToken.getConnectionForChain(destination);
    if (!connection) {
      return [{ destinationTokenKey: 'Unsupported Route' }, null];
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
