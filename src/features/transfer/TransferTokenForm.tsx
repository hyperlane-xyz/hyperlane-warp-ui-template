import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { Form, Formik, useFormikContext } from 'formik';
import { useMemo, useState } from 'react';

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
import { areAddressesEqual, isValidAddress } from '../../utils/addresses';
import { fromWei, fromWeiRounded, toWei, tryParseAmount } from '../../utils/amount';
import { logger } from '../../utils/logger';
import { ChainSelectField } from '../chains/ChainSelectField';
import { getProtocolType } from '../chains/caip2';
import { ProtocolSmallestUnit, ProtocolType } from '../chains/types';
import { getChainDisplayName } from '../chains/utils';
import { SelectOrInputTokenIds } from '../tokens/SelectOrInputTokenIds';
import { TokenSelectField } from '../tokens/TokenSelectField';
import {
  getCachedOwnerOf,
  getCachedTokenBalance,
  getCachedTokenIdBalance,
  useAccountTokenBalance,
  useTokenBalance,
} from '../tokens/balances';
import { RoutesMap, getTokenRoute, useRouteChains } from '../tokens/routes';
import { AccountInfo, useAccountForChain, useAccounts } from '../wallet/hooks';

import { TransferFormValues } from './types';
import { isTransferApproveRequired, useTokenTransfer } from './useTokenTransfer';

export function TransferTokenForm({ tokenRoutes }: { tokenRoutes: RoutesMap }) {
  const caip2Ids = useRouteChains(tokenRoutes);
  const initialValues: TransferFormValues = useMemo(() => {
    const firstRoute = Object.values(tokenRoutes[caip2Ids[0]])[0][0];
    return {
      originCaip2Id: firstRoute.originCaip2Id,
      destinationCaip2Id: firstRoute.destCaip2Id,
      amount: '',
      tokenAddress: '',
      recipientAddress: '',
    };
  }, [caip2Ids, tokenRoutes]);

  // Flag for if form is in input vs review mode
  const [isReview, setIsReview] = useState(false);
  // Flag for check current type of token
  const [isNft, setIsNft] = useState(false);

  const onSubmitForm = (values: TransferFormValues) => {
    logger.debug('Reviewing transfer form values:', JSON.stringify(values));
    setIsReview(true);
  };

  const onClickEdit = () => {
    setIsReview(false);
  };

  const queryClient = useQueryClient();
  const { accounts } = useAccounts();
  const validate = (values: TransferFormValues) =>
    validateFormValues(values, tokenRoutes, queryClient, accounts);

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
              name="originCaip2Id"
              label="From"
              caip2Ids={caip2Ids}
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
              name="destinationCaip2Id"
              label="To"
              caip2Ids={caip2Ids}
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
                originCaip2Id={values.originCaip2Id}
                destinationCaip2Id={values.destinationCaip2Id}
                tokenRoutes={tokenRoutes}
                disabled={isReview}
                setIsNft={setIsNft}
              />
            </div>
            <div className="flex-1">
              <div className="flex justify-between pr-1">
                <label htmlFor="amount" className="block uppercase text-sm text-gray-500 pl-0.5">
                  Amount
                </label>
                <SelfTokenBalance tokenRoutes={tokenRoutes} />
              </div>
              {isNft ? (
                <SelectOrInputTokenIds disabled={isReview} tokenRoutes={tokenRoutes} />
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
            <ConnectAwareSubmitButton
              caip2Id={values.originCaip2Id}
              text="Continue"
              classes="mt-4 px-3 py-1.5"
            />
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
                onClick={() => triggerTransactions(values, tokenRoutes)}
                classes="flex-1 px-3 py-1.5"
              >
                {`Send to ${getChainDisplayName(values.destinationCaip2Id)}`}
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
  const { originCaip2Id, destinationCaip2Id } = values;

  const onClick = () => {
    if (disabled) return;
    setFieldValue('originCaip2Id', destinationCaip2Id);
    setFieldValue('destinationCaip2Id', originCaip2Id);
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
  const { originCaip2Id, destinationCaip2Id, tokenAddress } = values;
  const route = getTokenRoute(originCaip2Id, destinationCaip2Id, tokenAddress, tokenRoutes);
  const tokenAddrToCheck =
    route?.baseCaip2Id === originCaip2Id ? tokenAddress : route?.originRouterAddress ?? '';
  const decimals = route?.decimals ?? STANDARD_TOKEN_DECIMALS;
  const { balance } = useAccountTokenBalance(originCaip2Id, tokenAddrToCheck);
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
  const { originCaip2Id, destinationCaip2Id, tokenAddress, recipientAddress } = values;
  const route = getTokenRoute(originCaip2Id, destinationCaip2Id, tokenAddress, tokenRoutes);
  const tokenAddrToCheck =
    route?.baseCaip2Id === destinationCaip2Id ? tokenAddress : route?.destRouterAddress ?? '';
  const { balance } = useTokenBalance(destinationCaip2Id, tokenAddrToCheck, recipientAddress);
  return <TokenBalance label="Remote balance" balance={balance} decimals={route?.decimals} />;
}

function MaxButton({ tokenRoutes, disabled }: { tokenRoutes: RoutesMap; disabled?: boolean }) {
  const { setFieldValue } = useFormikContext<TransferFormValues>();
  const { balance, decimals } = useSelfTokenBalance(tokenRoutes);
  const onClick = () => {
    if (balance && !disabled) setFieldValue('amount', fromWeiRounded(balance, decimals));
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
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const address = useAccountForChain(values.destinationCaip2Id)?.address;
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
    values: { amount, originCaip2Id, destinationCaip2Id, tokenAddress },
  } = useFormikContext<TransferFormValues>();

  const route = getTokenRoute(originCaip2Id, destinationCaip2Id, tokenAddress, tokenRoutes);
  const isNft = !!route?.isNft;
  const sendValue = isNft ? amount.toString() : toWei(amount, route?.decimals).toString();
  const isApproveRequired = route && isTransferApproveRequired(route, tokenAddress);
  const originProtocol = getProtocolType(originCaip2Id);
  const originUnitName = ProtocolSmallestUnit[originProtocol];

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
              <p>{`Collateral Address: ${route?.baseRouterAddress}`}</p>
            </div>
          </div>
        )}
        <div>
          <h4>{`Transaction${isApproveRequired ? ' 2' : ''}: Transfer Remote`}</h4>
          <div className="mt-1.5 ml-1.5 pl-2 border-l border-gray-300 space-y-1.5 text-xs">
            <p>{`Remote Token: ${route?.destRouterAddress}`}</p>
            {isNft ? (
              <p>{`Token ID: ${sendValue}`}</p>
            ) : (
              <p>{`Amount (${originUnitName}): ${sendValue}`}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function validateFormValues(
  { originCaip2Id, destinationCaip2Id, amount, tokenAddress, recipientAddress }: TransferFormValues,
  tokenRoutes: RoutesMap,
  queryClient: QueryClient,
  accounts: Record<ProtocolType, AccountInfo>,
) {
  const route = getTokenRoute(originCaip2Id, destinationCaip2Id, tokenAddress, tokenRoutes);
  const isNft = !!route?.isNft;

  const currentTokenAddress =
    route?.baseCaip2Id === originCaip2Id ? tokenAddress : route?.originRouterAddress ?? '';

  if (!originCaip2Id) return { originCaip2Id: 'Invalid origin chain' };
  if (!destinationCaip2Id) return { destinationCaip2Id: 'Invalid destination chain' };

  const originProtocol = getProtocolType(originCaip2Id);
  const destProtocol = getProtocolType(destinationCaip2Id);
  if (!isValidAddress(currentTokenAddress, originProtocol))
    return { tokenAddress: 'Invalid token' };
  if (!isValidAddress(recipientAddress, destProtocol))
    return { recipientAddress: 'Invalid recipient' };

  const accountAddress = accounts[originProtocol]?.address;

  const parsedAmount = tryParseAmount(amount);
  if (!parsedAmount || parsedAmount.lte(0))
    return { amount: isNft ? 'Invalid Token Id' : 'Invalid amount' };

  if (!isNft) {
    // Validate balances for ERC20-like tokens
    const cachedBalance = getCachedTokenBalance(
      queryClient,
      originCaip2Id,
      tokenAddress,
      accountAddress,
    );
    if (cachedBalance && parsedAmount.gt(cachedBalance) && !config.debug) {
      return { amount: 'Insufficient balance' };
    }
  } else {
    // Validate balances for ERC721-like tokens
    const cachedOwnerOf = getCachedOwnerOf(queryClient, originCaip2Id, currentTokenAddress, amount);
    const cachedTokenIdBalance = getCachedTokenIdBalance(
      queryClient,
      originCaip2Id,
      currentTokenAddress,
      accountAddress,
    );
    if (
      (cachedOwnerOf && accountAddress && !areAddressesEqual(accountAddress, cachedOwnerOf)) ||
      !cachedTokenIdBalance?.includes(amount.toString())
    ) {
      return { amount: 'Token ID not owned' };
    }
  }

  return {};
}
