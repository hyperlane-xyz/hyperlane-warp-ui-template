import { useFormikContext } from 'formik';
import { TextField } from '../../components/input/TextField';
import { TransferFormValues } from '../transfer/types';
import { SelectTokenIdField } from './SelectTokenIdField';

// import { useContractSupportsTokenByOwner, useIsSenderNftOwner } from './balances';

export function SelectOrInputTokenIds({
  disabled,
  // test helper: when true forces the input path instead of the select path
  forceInput,
}: {
  disabled: boolean;
  forceInput?: boolean;
}) {
  const {
    values: { tokenIndex },
  } = useFormikContext<TransferFormValues>();
  // const accountAddress = useAccountAddressForChain(origin);
  // const { isContractAllowToGetTokenIds } = useContractSupportsTokenByOwner(
  //   activeToken,
  //   accountAddress,
  // );
  // In production this would be derived from hooks; allow tests to override.
  const isContractAllowToGetTokenIds = forceInput ? false : true;

  return isContractAllowToGetTokenIds ? (
    <SelectTokenIdField name="amount" disabled={disabled} tokenIndex={tokenIndex} />
  ) : (
    <InputTokenId disabled={disabled} tokenIndex={tokenIndex} />
  );
}

function InputTokenId({ disabled }: { disabled: boolean; tokenIndex?: number }) {
  // const {
  //   values: { amount },
  // } = useFormikContext<TransferFormValues>();
  // useIsSenderNftOwner(token, amount);

  return (
    <div className="relative w-full">
      <TextField
        data-testid="text-field"
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
