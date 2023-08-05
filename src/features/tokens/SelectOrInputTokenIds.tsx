import { useFormikContext } from 'formik';

import { TextField } from '../../components/input/TextField';
import { AssetNamespace, getCaip19Id } from '../caip/tokens';
import { TransferFormValues } from '../transfer/types';
import { useAccountForChain } from '../wallet/hooks';

import { SelectTokenIdField } from './SelectTokenIdField';
import { useContractSupportsTokenByOwner, useIsSenderNftOwner } from './balances';
import { RouteType, RoutesMap } from './routes/types';
import { getTokenRoute } from './routes/utils';

export function SelectOrInputTokenIds({
  disabled,
  tokenRoutes,
}: {
  disabled: boolean;
  tokenRoutes: RoutesMap;
}) {
  const {
    values: { originCaip2Id, tokenCaip19Id, destinationCaip2Id },
  } = useFormikContext<TransferFormValues>();

  const route = getTokenRoute(originCaip2Id, destinationCaip2Id, tokenCaip19Id, tokenRoutes);

  let activeToken = '' as Caip19Id;
  if (route?.type === RouteType.BaseToSynthetic) {
    // If the origin is the base chain, use the collateralized token for balance checking
    activeToken = tokenCaip19Id;
  } else if (route) {
    // Otherwise, use the synthetic token for balance checking
    activeToken = getCaip19Id(
      route.originCaip2Id,
      AssetNamespace.erc721,
      route.originRouterAddress,
    );
  }

  const accountAddress = useAccountForChain(originCaip2Id)?.address;
  const { isContractAllowToGetTokenIds } = useContractSupportsTokenByOwner(
    activeToken,
    accountAddress,
  );

  return isContractAllowToGetTokenIds ? (
    <SelectTokenIdField name="amount" disabled={disabled} caip19Id={activeToken} />
  ) : (
    <InputTokenId disabled={disabled} caip19Id={activeToken} />
  );
}

function InputTokenId({ disabled, caip19Id }: { disabled: boolean; caip19Id: Caip19Id }) {
  const {
    values: { amount },
  } = useFormikContext<TransferFormValues>();
  useIsSenderNftOwner(caip19Id, amount);

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
