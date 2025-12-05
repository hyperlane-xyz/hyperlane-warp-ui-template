import { useFormikContext } from 'formik';
import { TextField } from '../../components/input/TextField';
import { TransferFormValues } from '../transfer/types';
import { SelectTokenIdField } from './SelectTokenIdField';

// import { useContractSupportsTokenByOwner, useIsSenderNftOwner } from './balances';

export function SelectOrInputTokenIds({ disabled }: { disabled: boolean }) {
  const {
    values: { tokenKey },
  } = useFormikContext<TransferFormValues>();
  // const accountAddress = useAccountAddressForChain(origin);
  // const { isContractAllowToGetTokenIds } = useContractSupportsTokenByOwner(
  //   activeToken,
  //   accountAddress,
  // );
  const isContractAllowToGetTokenIds = true;

  return isContractAllowToGetTokenIds ? (
    <SelectTokenIdField name="amount" disabled={disabled} tokenKey={tokenKey} />
  ) : (
    <InputTokenId disabled={disabled} tokenKey={tokenKey} />
  );
}

function InputTokenId({ disabled }: { disabled: boolean; tokenKey?: string }) {
  // const {
  //   values: { amount },
  // } = useFormikContext<TransferFormValues>();
  // useIsSenderNftOwner(token, amount);

  return (
    <div className="relative w-full">
      <TextField
        name="amount"
        placeholder="Input Token Id"
        className="w-full"
        type="number"
        step="any"
        disabled={disabled}
      />
    </div>
  );
}
