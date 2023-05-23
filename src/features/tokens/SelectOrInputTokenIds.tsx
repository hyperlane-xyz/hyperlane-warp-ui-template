import { useFormikContext } from 'formik';
import { useAccount } from 'wagmi';

import { TextField } from '../../components/input/TextField';
import { TransferFormValues } from '../transfer/types';

import { SelectTokenIdField } from './SelectTokenIdField';
import { useContractSupportsTokenByOwner } from './useTokenBalance';

export default function SelectOrInputTokenIds() {
  const { address } = useAccount();
  const {
    values: { originChainId, tokenAddress },
  } = useFormikContext<TransferFormValues>();

  const { isContractAllowToGetTokenIds } = useContractSupportsTokenByOwner(
    originChainId,
    tokenAddress,
    address,
  );

  return isContractAllowToGetTokenIds ? (
    <SelectTokenIdField name="amount" chainId={originChainId} tokenAddress={tokenAddress} />
  ) : (
    <div className="relative w-full">
      <TextField
        name="amount"
        placeholder="Input Token Id"
        classes="w-full"
        type="number"
        step="any"
      />
    </div>
  );
}
