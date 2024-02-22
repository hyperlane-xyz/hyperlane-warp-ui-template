import { Form, Formik, useFormikContext } from 'formik';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { TokenAmount } from '@hyperlane-xyz/sdk';
import { ProtocolType, toWei } from '@hyperlane-xyz/utils';

import { SmallSpinner } from '../../components/animation/SmallSpinner';
import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { IconButton } from '../../components/buttons/IconButton';
import { SolidButton } from '../../components/buttons/SolidButton';
import { ChevronIcon } from '../../components/icons/Chevron';
import { WideChevron } from '../../components/icons/WideChevron';
import { TextField } from '../../components/input/TextField';
import { getTokens, getWarpCore } from '../../context/context';
import SwapIcon from '../../images/icons/swap.svg';
import { Color } from '../../styles/Color';
import { logger } from '../../utils/logger';
import { ChainSelectField } from '../chains/ChainSelectField';
import { getChainDisplayName } from '../chains/utils';
import { useStore } from '../store';
import { SelectOrInputTokenIds } from '../tokens/SelectOrInputTokenIds';
import { TokenSelectField } from '../tokens/TokenSelectField';
import { useIsApproveRequired } from '../tokens/approval';
import { useDestinationBalance, useOriginBalance } from '../tokens/balances';
import {
  getAccountAddressForChain,
  useAccountAddressForChain,
  useAccounts,
} from '../wallet/hooks/multiProtocol';
import { AccountInfo } from '../wallet/hooks/types';

import { TransferFormValues } from './types';
import { useIgpQuote } from './useIgpQuote';
import { useTokenTransfer } from './useTokenTransfer';

export function TransferTokenForm() {
  const initialValues = useFormInitialValues();
  const { accounts } = useAccounts();

  // Flag for if form is in input vs review mode
  const [isReview, setIsReview] = useState(false);
  // Flag for check current type of token
  const [isNft, setIsNft] = useState(false);

  const validate = (values: TransferFormValues) => validateForm(values, accounts);

  const onSubmitForm = (values: TransferFormValues) => {
    logger.debug('Reviewing transfer form values for:', values.origin, values.destination);
    setIsReview(true);
  };

  return (
    <Formik<TransferFormValues>
      initialValues={initialValues}
      onSubmit={onSubmitForm}
      validate={validate}
      validateOnChange={false}
      validateOnBlur={false}
    >
      <Form className="flex flex-col items-stretch w-full mt-2">
        <ChainSelectSection isReview={isReview} />
        <div className="mt-3 flex justify-between items-end space-x-4">
          <TokenSection setIsNft={setIsNft} isReview={isReview} />
          <AmountSection isNft={isNft} isReview={isReview} />
        </div>
        <RecipientSection isReview={isReview} />
        <ReviewDetails visible={isReview} />
        <ButtonSection isReview={isReview} setIsReview={setIsReview} />
      </Form>
    </Formik>
  );
}

function SwapChainsButton({ disabled }: { disabled?: boolean }) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { origin, destination } = values;

  const onClick = () => {
    if (disabled) return;
    setFieldValue('origin', destination);
    setFieldValue('destination', origin);
    // Reset other fields on chain change
    setFieldValue('token', undefined);
    setFieldValue('recipient', '');
  };

  return (
    <IconButton
      imgSrc={SwapIcon}
      width={22}
      height={22}
      title="Swap chains"
      classes={!disabled ? 'hover:rotate-180' : undefined}
      onClick={onClick}
      disabled={disabled}
    />
  );
}

function ChainSelectSection({ isReview }: { isReview: boolean }) {
  const chains = useMemo(() => getWarpCore().getTokenChains(), []);

  return (
    <div className="flex items-center justify-center space-x-7 sm:space-x-10">
      <ChainSelectField name="origin" label="From" chains={chains} disabled={isReview} />
      <div className="flex flex-col items-center">
        <div className="flex mb-6 sm:space-x-1.5">
          <WideChevron classes="hidden sm:block" />
          <WideChevron />
          <WideChevron />
        </div>
        <SwapChainsButton disabled={isReview} />
      </div>
      <ChainSelectField name="destination" label="To" chains={chains} disabled={isReview} />
    </div>
  );
}

function TokenSection({
  setIsNft,
  isReview,
}: {
  setIsNft: (b: boolean) => void;
  isReview: boolean;
}) {
  const { values } = useFormikContext<TransferFormValues>();

  return (
    <div className="flex-1">
      <label htmlFor="token" className="block uppercase text-sm text-gray-500 pl-0.5">
        Token
      </label>
      <TokenSelectField
        name="token"
        origin={values.origin}
        destination={values.destination}
        disabled={isReview}
        setIsNft={setIsNft}
      />
    </div>
  );
}

function AmountSection({ isNft, isReview }: { isNft: boolean; isReview: boolean }) {
  const { values } = useFormikContext<TransferFormValues>();
  const { balance } = useOriginBalance(values);

  return (
    <div className="flex-1">
      <div className="flex justify-between pr-1">
        <label htmlFor="amount" className="block uppercase text-sm text-gray-500 pl-0.5">
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
            classes="w-full"
            type="number"
            step="any"
            disabled={isReview}
          />
          <MaxButton disabled={isReview} balance={balance} />
        </div>
      )}
    </div>
  );
}

function RecipientSection({ isReview }: { isReview: boolean }) {
  const { values } = useFormikContext<TransferFormValues>();
  const { balance } = useDestinationBalance(values);

  // A crude way to detect transfer completions by triggering
  // toast on recipient balance increase. This is not ideal because it
  // could confuse unrelated balance changes for message delivery
  // TODO replace with a polling worker that queries the hyperlane explorer
  const recipient = values.recipient;
  const prevRecipientBalance = useRef<{ balance?: TokenAmount; recipient?: string }>({
    recipient: '',
  });
  useEffect(() => {
    if (
      recipient &&
      balance &&
      prevRecipientBalance.current.balance &&
      prevRecipientBalance.current.recipient === recipient &&
      balance.equals(prevRecipientBalance.current.balance) &&
      balance.amount > prevRecipientBalance.current.balance.amount
    ) {
      toast.success('Recipient has received funds, transfer complete!');
    }
    prevRecipientBalance.current = { balance, recipient: recipient };
  }, [balance, recipient, prevRecipientBalance]);

  return (
    <div className="mt-4">
      <div className="flex justify-between pr-1">
        <label htmlFor="recipient" className="block uppercase text-sm text-gray-500 pl-0.5">
          Recipient Address
        </label>
        <TokenBalance label="Remote balance" balance={balance} />
      </div>
      <div className="relative w-full">
        <TextField
          name="recipient"
          placeholder="0x123456..."
          classes="w-full"
          disabled={isReview}
        />
        <SelfButton disabled={isReview} />
      </div>
    </div>
  );
}

function TokenBalance({ label, balance }: { label: string; balance?: TokenAmount | null }) {
  const value = balance?.getDecimalFormattedAmount().toFixed(4) || '0';
  return <div className="text-xs text-gray-500 text-right">{`${label}: ${value}`}</div>;
}

function ButtonSection({
  isReview,
  setIsReview,
}: {
  isReview: boolean;
  setIsReview: (b: boolean) => void;
}) {
  const { values } = useFormikContext<TransferFormValues>();

  const onDoneTransactions = () => {
    setIsReview(false);
    setTransferLoading(false);
    // resetForm();
  };
  const { triggerTransactions } = useTokenTransfer(onDoneTransactions);

  const { setTransferLoading } = useStore((s) => ({
    setTransferLoading: s.setTransferLoading,
  }));

  const triggerTransactionsHandler = async () => {
    setTransferLoading(true);
    await triggerTransactions(values);
  };

  if (!isReview) {
    return (
      <ConnectAwareSubmitButton
        chainName={values.origin}
        text="Continue"
        classes="mt-4 px-3 py-1.5"
      />
    );
  }

  return (
    <div className="mt-4 flex items-center justify-between space-x-4">
      <SolidButton
        type="button"
        color="gray"
        onClick={() => setIsReview(false)}
        classes="px-6 py-1.5"
        icon={<ChevronIcon direction="w" width={10} height={6} color={Color.primaryBlue} />}
      >
        <span>Edit</span>
      </SolidButton>
      <SolidButton
        type="button"
        color="pink"
        onClick={triggerTransactionsHandler}
        classes="flex-1 px-3 py-1.5"
      >
        {`Send to ${getChainDisplayName(values.destination)}`}
      </SolidButton>
    </div>
  );
}

function MaxButton({ balance, disabled }: { balance?: TokenAmount; disabled?: boolean }) {
  const { setFieldValue } = useFormikContext<TransferFormValues>();
  const onClick = () => {
    if (!balance || disabled) return;
    setFieldValue('amount', balance.getDecimalFormattedAmount().toFixed(4));
  };
  return (
    <SolidButton
      type="button"
      onClick={onClick}
      color="gray"
      disabled={disabled}
      classes="text-xs absolute right-0.5 top-2 bottom-0.5 px-2"
    >
      MAX
    </SolidButton>
  );
}

function SelfButton({ disabled }: { disabled?: boolean }) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const address = useAccountAddressForChain(values.destination);
  const onClick = () => {
    if (disabled) return;
    if (address) setFieldValue('recipient', address);
    else
      toast.warn(
        `No account found for for chain ${getChainDisplayName(
          values.destination,
        )}, is your wallet connected?`,
      );
  };
  return (
    <SolidButton
      type="button"
      onClick={onClick}
      color="gray"
      disabled={disabled}
      classes="text-xs absolute right-0.5 top-2 bottom-0.5 px-2"
    >
      SELF
    </SolidButton>
  );
}

function ReviewDetails({ visible }: { visible: boolean }) {
  const {
    values: { amount, destination, token: originToken },
  } = useFormikContext<TransferFormValues>();

  const destinationToken = originToken?.getConnectedTokenForChain(destination);
  const isNft = originToken?.isNft();
  const amountWei = isNft ? amount.toString() : toWei(amount, originToken?.decimals);
  const originTokenSymbol = originToken?.symbol || '';

  const { isLoading: isApproveLoading, isApproveRequired } = useIsApproveRequired(
    originToken,
    amountWei,
    visible,
  );
  const { isLoading: isQuoteLoading, igpQuote } = useIgpQuote(originToken, destination);

  const isLoading = isApproveLoading || isQuoteLoading;

  return (
    <div
      className={`${
        visible ? 'max-h-screen duration-1000 ease-in' : 'max-h-0 duration-500'
      } overflow-hidden transition-all`}
    >
      <label className="mt-4 block uppercase text-sm text-gray-500 pl-0.5">Transactions</label>
      {isLoading ? (
        <div className="py-6 flex items-center justify-center">
          <SmallSpinner />
        </div>
      ) : (
        <div className="mt-1.5 px-2.5 py-2 space-y-2 rounded border border-gray-400 bg-gray-150 text-sm break-all">
          {isApproveRequired && (
            <div>
              <h4>Transaction 1: Approve Transfer</h4>
              <div className="mt-1.5 ml-1.5 pl-2 border-l border-gray-300 space-y-1.5 text-xs">
                <p>{`Router Address: ${originToken?.addressOrDenom}`}</p>
                {originToken?.collateralAddressOrDenom && (
                  <p>{`Collateral Address: ${originToken.collateralAddressOrDenom}`}</p>
                )}
              </div>
            </div>
          )}
          <div>
            <h4>{`Transaction${isApproveRequired ? ' 2' : ''}: Transfer Remote`}</h4>
            <div className="mt-1.5 ml-1.5 pl-2 border-l border-gray-300 space-y-1.5 text-xs">
              {destinationToken?.addressOrDenom && (
                <p className="flex">
                  <span className="min-w-[7rem]">Remote Token</span>
                  <span>{destinationToken.addressOrDenom}</span>
                </p>
              )}
              {isNft ? (
                <p className="flex">
                  <span className="min-w-[7rem]">Token ID</span>
                  <span>{amount}</span>
                </p>
              ) : (
                <>
                  <p className="flex">
                    <span className="min-w-[7rem]">Amount</span>
                    <span>{`${amount} ${originTokenSymbol}`}</span>
                  </p>
                  <p className="flex">
                    <span className="min-w-[7rem]">Interchain Gas</span>
                    <span>{`${igpQuote?.amount || '0'} ${igpQuote?.token?.symbol || ''}`}</span>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function useFormInitialValues(): TransferFormValues {
  return useMemo(() => {
    const firstToken = getTokens().filter((t) => t.connectedTokens?.length)[0];
    const connectedToken = firstToken.connectedTokens![0];
    return {
      origin: firstToken.chainName,
      destination: connectedToken.chainName,
      token: firstToken,
      amount: '',
      recipient: '',
    };
  }, []);
}

function validateForm(values: TransferFormValues, accounts: Record<ProtocolType, AccountInfo>) {
  const { origin, destination, token, amount, recipient } = values;
  if (!token) return { token: 'Token is required' };
  const amountWei = toWei(amount, token.decimals);
  const sender = getAccountAddressForChain(origin, accounts) || '';
  return getWarpCore().validateTransfer(token.amount(amountWei), destination, sender, recipient);
}
