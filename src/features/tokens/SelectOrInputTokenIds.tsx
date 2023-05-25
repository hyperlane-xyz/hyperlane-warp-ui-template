import { useFormikContext } from 'formik';
import { useAccount } from 'wagmi';

import { TextField } from '../../components/input/TextField';
import { TransferFormValues } from '../transfer/types';

import { SelectTokenIdField } from './SelectTokenIdField';
import { useContractSupportsTokenByOwner, useOwnerOfErc721 } from './useTokenBalance';

export default function SelectOrInputTokenIds({ disabled }: { disabled: boolean }) {
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
    <SelectTokenIdField
      name="amount"
      disabled={disabled}
      chainId={originChainId}
      tokenAddress={tokenAddress}
    />
  ) : (
    <InputTokenId disabled={disabled} />
  );
}

function InputTokenId({ disabled }: { disabled: boolean }) {
  const {
    values: { originChainId, tokenAddress, amount },
  } = useFormikContext<TransferFormValues>();
  useOwnerOfErc721(originChainId, tokenAddress, amount);

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
