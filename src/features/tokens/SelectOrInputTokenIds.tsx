import { useFormikContext } from 'formik';

import { Token } from '@hyperlane-xyz/sdk';

import { TextField } from '../../components/input/TextField';
import { TransferFormValues } from '../transfer/types';

import { SelectTokenIdField } from './SelectTokenIdField';

// import { useContractSupportsTokenByOwner, useIsSenderNftOwner } from './balances';

export function SelectOrInputTokenIds({ disabled }: { disabled: boolean }) {
  const {
    values: { token },
  } = useFormikContext<TransferFormValues>();
  // const accountAddress = useAccountAddressForChain(origin);
  // const { isContractAllowToGetTokenIds } = useContractSupportsTokenByOwner(
  //   activeToken,
  //   accountAddress,
  // );
  const isContractAllowToGetTokenIds = true;

  return isContractAllowToGetTokenIds ? (
    <SelectTokenIdField name="amount" disabled={disabled} token={token} />
  ) : (
    <InputTokenId disabled={disabled} token={token} />
  );
}

function InputTokenId({ disabled }: { disabled: boolean; token?: Token }) {
  // const {
  //   values: { amount },
  // } = useFormikContext<TransferFormValues>();
  // useIsSenderNftOwner(token, amount);

  return (
    <div className="relative w-full">
      <TextField
        name="amount"
        placeholder="Input Token Id"
        classes="w-full"
        type="number"
        step="any"
        disabled={disabled}
      />
    </div>
  );
}
