import { useFormikContext } from 'formik';
import { useAccount } from 'wagmi';

import { TextField } from '../../components/input/TextField';
import { TransferFormValues } from '../transfer/types';

import { SelectTokenIdField } from './SelectTokenIdField';
import { RoutesMap, getTokenRoute } from './routes';
import { useContractSupportsTokenByOwner, useOwnerOfErc721 } from './useTokenBalance';

export default function SelectOrInputTokenIds({
  disabled,
  tokenRoutes,
}: {
  disabled: boolean;
  tokenRoutes: RoutesMap;
}) {
  const { address } = useAccount();
  const {
    values: { originChainId, tokenAddress, destinationChainId },
  } = useFormikContext<TransferFormValues>();

  const route = getTokenRoute(originChainId, destinationChainId, tokenAddress, tokenRoutes);

  const currentTokenAddress = !route
    ? ''
    : route.baseChainId === originChainId
    ? tokenAddress
    : route.originTokenAddress;

  const { isContractAllowToGetTokenIds } = useContractSupportsTokenByOwner(
    originChainId,
    currentTokenAddress,
    address,
  );

  return isContractAllowToGetTokenIds ? (
    <SelectTokenIdField
      name="amount"
      disabled={disabled}
      chainId={originChainId}
      tokenAddress={currentTokenAddress}
    />
  ) : (
    <InputTokenId disabled={disabled} tokenAddress={tokenAddress} />
  );
}

function InputTokenId({ disabled, tokenAddress }: { disabled: boolean; tokenAddress: Address }) {
  const {
    values: { originChainId, amount },
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
