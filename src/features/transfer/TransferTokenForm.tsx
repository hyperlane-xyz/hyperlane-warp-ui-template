import { Form, Formik, useFormikContext } from 'formik';
import { chain } from 'wagmi';

import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { IconButton } from '../../components/buttons/IconButton';
import { HyperlaneChevron, HyperlaneWideChevron } from '../../components/icons/HyperlaneChevron';
import { TextField } from '../../components/input/TextField';
import { Card } from '../../components/layout/Card';
import { chainIdToChain } from '../../consts/chains';
import GearIcon from '../../images/icons/gear.svg';
import SwapIcon from '../../images/icons/swap.svg';
import { Color } from '../../styles/Color';
import { isValidAddress } from '../../utils/addresses';
import { ChainSelectField } from '../chains/ChainSelectField';
import { TokenSelectField } from '../tokens/TokenSelectField';

import { TransferFormValues } from './types';

const initialValues: TransferFormValues = {
  sourceChainId: chain.mainnet.id,
  destinationChainId: chain.polygon.id,
  amount: '',
  tokenAddress: '',
  recipientAddress: '',
};

export function TransferTokenForm() {
  const onSubmit = (values: TransferFormValues) => {
    alert(JSON.stringify(values));
  };

  const validateForm = ({
    sourceChainId,
    destinationChainId,
    amount,
    tokenAddress,
    recipientAddress,
  }: TransferFormValues) => {
    if (!sourceChainId || !chainIdToChain[sourceChainId]) {
      return { sourceChainId: 'Invalid source chain' };
    }
    if (!destinationChainId || !chainIdToChain[destinationChainId]) {
      return { destinationChainId: 'Invalid destination chain' };
    }
    // TODO check balance
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
        onSubmit={onSubmit}
        validate={validateForm}
        validateOnChange={false}
        validateOnBlur={false}
      >
        <Form className="flex flex-col items-stretch w-full mt-2 space-y-4">
          <div className="flex items-center justify-center space-x-10">
            <ChainSelectField name="sourceChainId" label="From" />
            <div className="flex flex-col items-center">
              <div className="flex mb-6 space-x-1.5">
                <HyperlaneChevron width="17" height="100%" direction="e" color={Color.lightGray} />
                <HyperlaneChevron width="17" height="100%" direction="e" color={Color.lightGray} />
                <HyperlaneChevron width="17" height="100%" direction="e" color={Color.lightGray} />
              </div>
              <SwapChainsButton />
            </div>
            <ChainSelectField name="destinationChainId" label="To" />
          </div>
          <div className="flex justify-between space-x-4">
            <div className="flex-1">
              <label
                htmlFor="tokenAddress"
                className="block uppercase text-sm text-gray-500 pl-0.5"
              >
                ERC-20 Token
              </label>
              <TokenSelectField name="tokenAddress" chainFieldName="sourceChainId" />
            </div>
            <div className="flex-1">
              <label htmlFor="amount" className="block uppercase text-sm text-gray-500 pl-0.5">
                Amount
              </label>
              <TextField name="amount" placeholder="0.00" classes="w-full" />
            </div>
          </div>
          <div>
            <label
              htmlFor="recipientAddress"
              className="block uppercase text-sm text-gray-500 pl-0.5"
            >
              Recipient Address
            </label>
            <TextField name="recipientAddress" placeholder="0x123456..." classes="w-full" />
          </div>
          <ConnectAwareSubmitButton text="Continue" classes="px-3 py-1.5" />
        </Form>
      </Formik>
    </Card>
  );
}

function SwapChainsButton() {
  const { values, setFieldValue } = useFormikContext<TransferFormValues>();
  const { sourceChainId, destinationChainId } = values;

  const onClick = () => {
    setFieldValue('sourceChainId', destinationChainId);
    setFieldValue('destinationChainId', sourceChainId);
  };

  return (
    <IconButton
      imgSrc={SwapIcon}
      width={22}
      height={22}
      title="Swap chains"
      classes="hover:rotate-180"
      onClick={onClick}
    />
  );
}
