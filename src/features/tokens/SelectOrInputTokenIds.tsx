import { useFormikContext } from 'formik';
import { useAccount } from 'wagmi';

import { TextField } from '../../components/input/TextField';
import { TransferFormValues } from '../transfer/types';

import { SelectTokenIdField } from './SelectTokenIdField';
import { useContractSupportsTokenByOwner, useOwnerOfErc721 } from './balances';
import { RoutesMap, getTokenRoute } from './routes';

export function SelectOrInputTokenIds({
  disabled,
  tokenRoutes,
}: {
  disabled: boolean;
  tokenRoutes: RoutesMap;
}) {
  const { address } = useAccount();
  const {
    values: { originCaip2Id, tokenAddress, destinationCaip2Id },
  } = useFormikContext<TransferFormValues>();

  const route = getTokenRoute(originCaip2Id, destinationCaip2Id, tokenAddress, tokenRoutes);

  const currentTokenAddress =
    route?.baseCaip2Id === originCaip2Id ? tokenAddress : route?.originTokenAddress ?? '';

  const { isContractAllowToGetTokenIds } = useContractSupportsTokenByOwner(
    originCaip2Id,
    currentTokenAddress,
    address,
  );

  return isContractAllowToGetTokenIds ? (
    <SelectTokenIdField
      name="amount"
      disabled={disabled}
      caip2Id={originCaip2Id}
      tokenAddress={currentTokenAddress}
    />
  ) : (
    <InputTokenId disabled={disabled} tokenAddress={tokenAddress} />
  );
}

function InputTokenId({ disabled, tokenAddress }: { disabled: boolean; tokenAddress: Address }) {
  const {
    values: { originCaip2Id, amount },
  } = useFormikContext<TransferFormValues>();
  useOwnerOfErc721(originCaip2Id, tokenAddress, amount);

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
