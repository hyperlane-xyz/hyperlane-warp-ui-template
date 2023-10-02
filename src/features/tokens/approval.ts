import { useQuery } from '@tanstack/react-query';

import { ProtocolType, eqAddress } from '@hyperlane-xyz/utils';

import { logger } from '../../utils/logger';
import { getProtocolType } from '../caip/chains';
import { getTokenAddress, isNativeToken, isNonFungibleToken } from '../caip/tokens';
import { getEvmProvider } from '../multiProvider';
import { useAccountForChain } from '../wallet/hooks';

import { getErc20Contract, getErc721Contract } from './contracts/evmContracts';
import { Route } from './routes/types';
import { isRouteFromCollateral } from './routes/utils';

export function useIsApproveRequired(
  tokenCaip19Id: TokenCaip19Id,
  amount: string,
  route?: Route,
  enabled = true,
) {
  const owner = useAccountForChain(route?.originCaip2Id)?.address;

  const {
    isLoading,
    isError: hasError,
    data,
  } = useQuery({
    queryKey: ['useIsApproveRequired', route, tokenCaip19Id, owner, amount],
    queryFn: async () => {
      if (!route || !tokenCaip19Id || !owner || !amount) return false;
      return isApproveRequired(route, tokenCaip19Id, amount, owner);
    },
    enabled,
  });

  return { isLoading, hasError, isApproveRequired: !!data };
}

export async function isApproveRequired(
  route: Route,
  tokenCaip19Id: TokenCaip19Id,
  amount: string,
  owner: Address,
) {
  if (
    isNativeToken(tokenCaip19Id) ||
    !isRouteFromCollateral(route) ||
    getProtocolType(route.originCaip2Id) !== ProtocolType.Ethereum
  ) {
    return false;
  }
  const spender = route.baseRouterAddress;
  const provider = getEvmProvider(route.originCaip2Id);
  const tokenAddress = getTokenAddress(tokenCaip19Id);
  let isRequired: boolean;
  if (isNonFungibleToken(tokenCaip19Id)) {
    const contract = getErc721Contract(tokenAddress, provider);
    const approvedAddress = await contract.getApproved(amount);
    isRequired = !eqAddress(approvedAddress, spender);
  } else {
    const contract = getErc20Contract(tokenAddress, provider);
    const allowance = await contract.allowance(owner, spender);
    isRequired = allowance.lt(amount);
  }
  logger.debug(`Approval is${isRequired ? '' : ' not'} required for transfer of ${tokenCaip19Id}`);
  return isRequired;
}
