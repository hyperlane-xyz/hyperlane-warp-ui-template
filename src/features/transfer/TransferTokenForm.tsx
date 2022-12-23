import { Form, Formik, useFormikContext } from 'formik';
import { useState } from 'react';

import { chainIdToMetadata, chainMetadata } from '@hyperlane-xyz/sdk';

import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { IconButton } from '../../components/buttons/IconButton';
import { SolidButton } from '../../components/buttons/SolidButton';
import { ChevronIcon } from '../../components/icons/Chevron';
import { HyperlaneChevron, HyperlaneWideChevron } from '../../components/icons/HyperlaneChevron';
import { TextField } from '../../components/input/TextField';
import { Card } from '../../components/layout/Card';
import GearIcon from '../../images/icons/gear.svg';
import SwapIcon from '../../images/icons/swap.svg';
import { Color } from '../../styles/Color';
import { isValidAddress } from '../../utils/addresses';
import { fromWeiRounded } from '../../utils/amount';
import { getChainDisplayName, getChainEnvironment } from '../../utils/chains';
import { logger } from '../../utils/logger';
import { ChainSelectField } from '../chains/ChainSelectField';
import { TokenSelectField } from '../tokens/TokenSelectField';
import { useTokenBalance } from '../tokens/useTokenBalance';

import { TransferFormValues } from './types';

const initialValues: TransferFormValues = {
  sourceChainId: chainMetadata.goerli.id,
  destinationChainId: chainMetadata.alfajores.id,
  amount: '',
  tokenAddress: '',
  recipientAddress: '',
};

export function TransferTokenForm() {
  // Flag for if form is in input vs review mode
  const [isReview, setIsReview] = useState(false);

  const onSubmitForm = (values: TransferFormValues) => {
    logger.debug('Reviewing transfer form values:', JSON.stringify(values));
    setIsReview(true);
  };

  const onClickConfirm = (values: TransferFormValues) => {
    alert(JSON.stringify(values));
  };

  const onClickEdit = () => {
    setIsReview(false);
  };

  const validateForm = ({
    sourceChainId,
    destinationChainId,
    amount,
    tokenAddress,
    recipientAddress,
  }: TransferFormValues) => {
    if (!sourceChainId || !chainIdToMetadata[sourceChainId]) {
      return { sourceChainId: 'Invalid source chain' };
    }
    if (!destinationChainId || !chainIdToMetadata[destinationChainId]) {
      return { destinationChainId: 'Invalid destination chain' };
    }
    if (getChainEnvironment(sourceChainId) !== getChainEnvironment(destinationChainId)) {
      return { destinationChainId: 'Invalid chain combination' };
    }
    // TODO check balance and check non-zero
    if (!amount) {
      return { amount: 'Invalid amount' };
    }
    if (!isValidAddress(recipientAddress)) {
      return { recipientAddress: 'Invalid recipient' };
    }
    if (!isValidAddress(tokenAddress)) {
      return { tokenAddress: 'Invalid token' };
    }
    return {};
  };

  return (
    <Card classes="w-[33.5rem] relative">
      <div className="absolute left-0 right-0 -top-24 flex justify-center overflow-hidden z-10">
        <HyperlaneWideChevron direction="s" height="100%" width="100" />
      </div>
      <div className="relative flex items-start justify-between z-20">
        <h2 className="pl-0.5 text-lg">Send Tokens</h2>
        <IconButton
          imgSrc={GearIcon}
          width={20}
          height={20}
          title="Settings"
          classes="hover:rotate-90"
        />
      </div>
      <Formik<TransferFormValues>
        initialValues={initialValues}
        onSubmit={onSubmitForm}
        validate={validateForm}
        validateOnChange={false}
        validateOnBlur={false}
      >
        {({ values }) => (
          <Form className="flex flex-col items-stretch w-full mt-2 space-y-4">
            <div className="flex items-center justify-center space-x-10">
              <ChainSelectField name="sourceChainId" label="From" disabled={isReview} />
              <div className="flex flex-col items-center">
                <div className="flex mb-6 space-x-1.5">
                  <HyperlaneChevron
                    width="17"
                    height="100%"
                    direction="e"
                    color={Color.lightGray}
                  />
                  <HyperlaneChevron
                    width="17"
                    height="100%"
                    direction="e"
                    color={Color.lightGray}
                  />
                  <HyperlaneChevron
                    width="17"
                    height="100%"
                    direction="e"
                    color={Color.lightGray}
                  />
                </div>
                <SwapChainsButton disabled={isReview} />
              </div>
              <ChainSelectField name="destinationChainId" label="To" disabled={isReview} />
            </div>
            <div className="flex justify-between space-x-4">
              <div className="flex-1">
                <label
                  htmlFor="tokenAddress"
                  className="block uppercase text-sm text-gray-500 pl-0.5"
                >
                  ERC-20 Token
                </label>
                <TokenSelectField
                  name="tokenAddress"
                  chainFieldName="sourceChainId"
                  disabled={isReview}
                />
              </div>
              <div className="flex-1">
                <div className="flex justify-between pr-1">
                  <label htmlFor="amount" className="block uppercase text-sm text-gray-500 pl-0.5">
                    Amount
                  </label>
                  <TokenBalance disabled={isReview} />
                </div>
                <TextField name="amount" placeholder="0.00" classes="w-full" disabled={isReview} />
              </div>
            </div>
            <div>
              <label
                htmlFor="recipientAddress"
                className="block uppercase text-sm text-gray-500 pl-0.5"
              >
                Recipient Address
              </label>
              <TextField
                name="recipientAddress"
                placeholder="0x123456..."
                classes="w-full"
                disabled={isReview}
              />
            </div>
            <ReviewDetails visible={isReview} />
            {!isReview ? (
              <ConnectAwareSubmitButton text="Continue" classes="px-3 py-1.5" />
            ) : (
              <div className="flex items-center justify-between space-x-4">
                <SolidButton
                  type="button"
                  color="gray"
                  onClick={onClickEdit}
                  classes="px-6 py-1.5"
                  icon={<ChevronIcon direction="w" width={13} color={Color.primaryBlue} />}
                >
                  <span>Edit</span>
                </SolidButton>
                <SolidButton
                  type="button"
                  color="blue"
                  onClick={() => onClickConfirm(values)}
                  classes="flex-1 px-3 py-1.5"
                >
                  {`Send to ${getChainDisplayName(values.destinationChainId)}`}
                </SolidButton>
              </div>
            )}
          </Form>
        )}
      </Formik>
    </Card>
  );
}

function SwapChainsButton({ disabled }: { disabled?: boolean }) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { sourceChainId, destinationChainId } = values;

  const onClick = () => {
    if (disabled) return;
    setFieldValue('sourceChainId', destinationChainId);
    setFieldValue('destinationChainId', sourceChainId);
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

function TokenBalance({ disabled }: { disabled?: boolean }) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { balance } = useTokenBalance(values.sourceChainId, values.tokenAddress);
  const onClick = () => {
    if (balance && !disabled) setFieldValue('amount', balance);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs text-gray-500 ${
        !balance && 'opacity-0 cursor-default'
      } transition-all duration-300`}
    >{`Balance: ${fromWeiRounded(balance)}`}</button>
  );
}

function ReviewDetails({ visible }: { visible: boolean }) {
  const { values } = useFormikContext<TransferFormValues>();
  return (
    <div
      className={`${
        visible ? 'max-h-screen duration-1000 ease-in' : 'max-h-0 duration-500'
      } overflow-hidden transition-all`}
    >
      <label className="block uppercase text-sm text-gray-500 pl-0.5">Transactions</label>
      <div className="mt-1.5 px-2.5 py-2 rounded border border-gray-400 bg-gray-150 text-sm break-all">
        {JSON.stringify(values)}
      </div>
    </div>
  );
}
