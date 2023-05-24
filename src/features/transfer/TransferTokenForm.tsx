import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { Form, Formik, useFormikContext } from 'formik';
import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';

import { WideChevron } from '@hyperlane-xyz/widgets';

import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { IconButton } from '../../components/buttons/IconButton';
import { SolidButton } from '../../components/buttons/SolidButton';
import { ChevronIcon } from '../../components/icons/Chevron';
import { TextField } from '../../components/input/TextField';
import { config } from '../../consts/config';
import { STANDARD_TOKEN_DECIMALS } from '../../consts/values';
import SwapIcon from '../../images/icons/swap.svg';
import { Color } from '../../styles/Color';
import { isValidAddress } from '../../utils/addresses';
import { fromWei, fromWeiRounded, toWei, tryParseAmount } from '../../utils/amount';
import { logger } from '../../utils/logger';
import { ChainSelectField } from '../chains/ChainSelectField';
import { getChainDisplayName } from '../chains/utils';
import SelectOrInputTokenIds from '../tokens/SelectOrInputTokenIds';
import { TokenSelectField } from '../tokens/TokenSelectField';
import { RoutesMap, getTokenRoute, useRouteChains } from '../tokens/routes';
import {
  getCachedOwnerOf,
  getCachedTokenBalance,
  useAccountTokenBalance,
  useOwnerOfErc721,
} from '../tokens/useTokenBalance';

import { TransferFormValues } from './types';
import { isTransferApproveRequired, useTokenTransfer } from './useTokenTransfer';

export function TransferTokenForm({ tokenRoutes }: { tokenRoutes: RoutesMap }) {
  const chainIds = useRouteChains(tokenRoutes);
  const initialValues: TransferFormValues = useMemo(
    () => ({
      originChainId: chainIds[0],
      destinationChainId: chainIds[1],
      amount: '',
      tokenAddress: '',
      recipientAddress: '',
    }),
    [chainIds],
  );

  // Flag for if form is in input vs review mode
  const [isReview, setIsReview] = useState(false);
  // Flag for check current type of token
  const [isERC721, setIsERC721] = useState(false);

  const onSubmitForm = (values: TransferFormValues) => {
    logger.debug('Reviewing transfer form values:', JSON.stringify(values));
    setIsReview(true);
  };

  const onClickEdit = () => {
    setIsReview(false);
  };

  const queryClient = useQueryClient();
  const { address: accountAddress } = useAccount();
  const validate = (values: TransferFormValues) =>
    validateFormValues(values, queryClient, accountAddress, isERC721);

  const onDoneTransactions = () => {
    setIsReview(false);
    // Consider clearing form inputs here
  };
  const { triggerTransactions } = useTokenTransfer(onDoneTransactions);

  return (
    <Formik<TransferFormValues>
      initialValues={initialValues}
      onSubmit={onSubmitForm}
      validate={validate}
      validateOnChange={false}
      validateOnBlur={false}
    >
      {({ values }) => (
        <Form className="flex flex-col items-stretch w-full mt-2">
          <div className="flex items-center justify-center space-x-7 sm:space-x-10">
            <ChainSelectField
              name="originChainId"
              label="From"
              chainIds={chainIds}
              disabled={isReview}
            />
            <div className="flex flex-col items-center">
              <div className="flex mb-6 sm:space-x-1.5">
                <WideChevron
                  width="17"
                  height="100%"
                  direction="e"
                  color={Color.lightGray}
                  classes="hidden sm:block"
                  rounded={true}
                />
                <WideChevron
                  width="17"
                  height="100%"
                  direction="e"
                  color={Color.lightGray}
                  rounded={true}
                />
                <WideChevron
                  width="17"
                  height="100%"
                  direction="e"
                  color={Color.lightGray}
                  rounded={true}
                />
              </div>
              <SwapChainsButton disabled={isReview} />
            </div>
            <ChainSelectField
              name="destinationChainId"
              label="To"
              chainIds={chainIds}
              disabled={isReview}
            />
          </div>
          <div className="mt-3 flex justify-between space-x-4">
            <div className="flex-1">
              <label
                htmlFor="tokenAddress"
                className="block uppercase text-sm text-gray-500 pl-0.5"
              >
                Token
              </label>
              <TokenSelectField
                name="tokenAddress"
                originChainId={values.originChainId}
                destinationChainId={values.destinationChainId}
                tokenRoutes={tokenRoutes}
                disabled={isReview}
                setIsERC721={setIsERC721}
              />
            </div>
            <div className="flex-1">
              <div className="flex justify-between pr-1">
                <label htmlFor="amount" className="block uppercase text-sm text-gray-500 pl-0.5">
                  {isERC721 ? 'Token ID' : 'Amount'}
                </label>
                <SelfTokenBalance tokenRoutes={tokenRoutes} />
              </div>
              {isERC721 ? (
                <SelectOrInputTokenIds />
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
                  <MaxButton disabled={isReview} tokenRoutes={tokenRoutes} />
                </div>
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between pr-1">
              <label
                htmlFor="recipientAddress"
                className="block uppercase text-sm text-gray-500 pl-0.5"
              >
                Recipient Address
              </label>
              <RecipientTokenBalance tokenRoutes={tokenRoutes} />
            </div>
            <div className="relative w-full">
              <TextField
                name="recipientAddress"
                placeholder="0x123456..."
                classes="w-full"
                disabled={isReview}
              />
              <SelfButton disabled={isReview} />
            </div>
          </div>
          <ReviewDetails visible={isReview} tokenRoutes={tokenRoutes} />
          {!isReview ? (
            <ConnectAwareSubmitButton text="Continue" classes="mt-4 px-3 py-1.5" />
          ) : (
            <div className="mt-4 flex items-center justify-between space-x-4">
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
                onClick={() => triggerTransactions(values, tokenRoutes, isERC721)}
                classes="flex-1 px-3 py-1.5"
              >
                {`Send to ${getChainDisplayName(values.destinationChainId)}`}
              </SolidButton>
            </div>
          )}
        </Form>
      )}
    </Formik>
  );
}

function SwapChainsButton({ disabled }: { disabled?: boolean }) {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { originChainId, destinationChainId } = values;

  const onClick = () => {
    if (disabled) return;
    setFieldValue('originChainId', destinationChainId);
    setFieldValue('destinationChainId', originChainId);
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

function TokenBalance({
  label,
  balance,
  decimals,
}: {
  label: string;
  balance?: string | null;
  decimals?: number;
}) {
  const value = !decimals ? fromWei(balance, decimals) : fromWeiRounded(balance, decimals);

  return <div className="text-xs text-gray-500">{`${label}: ${value}`}</div>;
}

function useSelfTokenBalance(tokenRoutes) {
  const { values } = useFormikContext<TransferFormValues>();
  const { originChainId, destinationChainId, tokenAddress, amount } = values;
  const route = getTokenRoute(originChainId, destinationChainId, tokenAddress, tokenRoutes);
  const addressForBalance = !route
    ? ''
    : route.baseChainId === originChainId
    ? tokenAddress
    : route.originTokenAddress;
  const decimals = !route ? STANDARD_TOKEN_DECIMALS : route.decimals;
  const { balance } = useAccountTokenBalance(originChainId, addressForBalance);
  useOwnerOfErc721(originChainId, tokenAddress, amount);
  return {
    balance,
    decimals,
  };
}

function SelfTokenBalance({ tokenRoutes }: { tokenRoutes: RoutesMap }) {
  const { balance, decimals } = useSelfTokenBalance(tokenRoutes);
  return <TokenBalance label="My balance" balance={balance} decimals={decimals} />;
}

function RecipientTokenBalance({ tokenRoutes }: { tokenRoutes: RoutesMap }) {
  const { values } = useFormikContext<TransferFormValues>();
  const { originChainId, destinationChainId, tokenAddress } = values;
  const route = getTokenRoute(originChainId, destinationChainId, tokenAddress, tokenRoutes);
  const addressForBalance = !route
    ? ''
    : route.baseChainId === destinationChainId
    ? tokenAddress
    : route.destTokenAddress;
  const { balance } = useAccountTokenBalance(destinationChainId, addressForBalance);
  return <TokenBalance label="Remote balance" balance={balance} decimals={route?.decimals} />;
}

function MaxButton({ tokenRoutes, disabled }: { tokenRoutes: RoutesMap; disabled?: boolean }) {
  const { setFieldValue } = useFormikContext<TransferFormValues>();
  const { balance } = useSelfTokenBalance(tokenRoutes);
  const onClick = () => {
    if (balance && !disabled) setFieldValue('amount', fromWeiRounded(balance));
  };
  return (
    <SolidButton
      type="button"
      onClick={onClick}
      color="gray"
      disabled={disabled}
      classes="text-xs rounded-sm absolute right-0.5 top-2 bottom-0.5 px-2"
    >
      MAX
    </SolidButton>
  );
}

function SelfButton({ disabled }: { disabled?: boolean }) {
  const { address } = useAccount();
  const { setFieldValue } = useFormikContext<TransferFormValues>();
  const onClick = () => {
    if (address && !disabled) setFieldValue('recipientAddress', address);
  };
  return (
    <SolidButton
      type="button"
      onClick={onClick}
      color="gray"
      disabled={disabled}
      classes="text-xs rounded-sm absolute right-0.5 top-2 bottom-0.5 px-1.5"
    >
      SELF
    </SolidButton>
  );
}

function ReviewDetails({ visible, tokenRoutes }: { visible: boolean; tokenRoutes: RoutesMap }) {
  const {
    values: { amount, originChainId, destinationChainId, tokenAddress },
  } = useFormikContext<TransferFormValues>();

  const route = getTokenRoute(originChainId, destinationChainId, tokenAddress, tokenRoutes);
  const isERC721 = route?.isERC721;
  const sendValue = isERC721 ? amount.toString() : toWei(amount, route?.decimals).toString();

  const isApproveRequired = route && isTransferApproveRequired(route, tokenAddress);
  return (
    <div
      className={`${
        visible ? 'max-h-screen duration-1000 ease-in' : 'max-h-0 duration-500'
      } overflow-hidden transition-all`}
    >
      <label className="mt-4 block uppercase text-sm text-gray-500 pl-0.5">Transactions</label>
      <div className="mt-1.5 px-2.5 py-2 space-y-2 rounded border border-gray-400 bg-gray-150 text-sm break-all">
        {isApproveRequired && (
          <div>
            <h4>Transaction 1: Approve Transfer</h4>
            <div className="mt-1.5 ml-1.5 pl-2 border-l border-gray-300 space-y-1.5 text-xs">
              <p>{`Token Address: ${tokenAddress}`}</p>
              <p>{`Collateral Address: ${route?.tokenRouterAddress}`}</p>
            </div>
          </div>
        )}
        <div>
          <h4>{`Transaction${isApproveRequired ? ' 2' : ''}: Transfer Remote`}</h4>
          <div className="mt-1.5 ml-1.5 pl-2 border-l border-gray-300 space-y-1.5 text-xs">
            <p>{`Remote Token: ${route?.destTokenAddress}`}</p>
            {isERC721 ? <p>{`Token ID: ${sendValue}`}</p> : <p>{`Amount (wei): ${sendValue}`}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function validateFormValues(
  { originChainId, destinationChainId, amount, tokenAddress, recipientAddress }: TransferFormValues,
  queryClient: QueryClient,
  accountAddress?: string,
  isERC721?: boolean,
) {
  if (!originChainId) return { originChainId: 'Invalid origin chain' };
  if (!destinationChainId) return { destinationChainId: 'Invalid destination chain' };
  if (!isValidAddress(recipientAddress)) return { recipientAddress: 'Invalid recipient' };
  if (!isValidAddress(tokenAddress)) return { tokenAddress: 'Invalid token' };
  const parsedAmount = tryParseAmount(amount);

  if (!parsedAmount || parsedAmount.lte(0))
    return isERC721 ? { amount: 'Invalid Token Id' } : { amount: 'Invalid amount' };
  if (
    isERC721 &&
    accountAddress != getCachedOwnerOf(queryClient, originChainId, tokenAddress, amount)
  ) {
    return { amount: 'Token ID not owned' };
  }
  const cachedBalance = getCachedTokenBalance(
    queryClient,
    originChainId,
    tokenAddress,
    accountAddress,
  );
  if (!isERC721 && cachedBalance && parsedAmount.gt(cachedBalance) && !config.debug) {
    return { amount: 'Insufficient balance' };
  }

  return {};
}
