import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { IHypTokenAdapter } from '@hyperlane-xyz/sdk';
import { ProtocolType, fromWei } from '@hyperlane-xyz/utils';

import { COSM_IGP_QUOTE, SOL_IGP_QUOTE } from '../../consts/values';
import { getChainReference, getProtocolType } from '../caip/chains';
import { AssetNamespace, getCaip19Id, getNativeTokenAddress } from '../caip/tokens';
import { getChainMetadata, getMultiProvider } from '../multiProvider';
import { useStore } from '../store';
import { AdapterFactory } from '../tokens/AdapterFactory';
import { findTokensByAddress, getToken } from '../tokens/metadata';
import { Route } from '../tokens/routes/types';
import {
  isIbcOnlyRoute,
  isIbcToWarpRoute,
  isRouteFromCollateral,
  isRouteFromNative,
} from '../tokens/routes/utils';

import { IgpQuote, IgpTokenType } from './types';

const DEFAULT_IGP_QUOTES = {
  [ProtocolType.Sealevel]: SOL_IGP_QUOTE,
  [ProtocolType.Cosmos]: COSM_IGP_QUOTE,
};

export function useIgpQuote(route?: Route) {
  const setIgpQuote = useStore((state) => state.setIgpQuote);

  const {
    isLoading,
    isError: hasError,
    data,
  } = useQuery({
    queryKey: ['useIgpQuote', route],
    queryFn: () => {
      if (!route || isIbcOnlyRoute(route)) return null;
      return fetchIgpQuote(route);
    },
  });

  useEffect(() => {
    setIgpQuote(data || null);
  }, [data, setIgpQuote]);

  return { isLoading, hasError, igpQuote: data };
}

export async function fetchIgpQuote(route: Route, adapter?: IHypTokenAdapter): Promise<IgpQuote> {
  const { baseTokenCaip19Id, originCaip2Id, destCaip2Id: destinationCaip2Id } = route;
  const originProtocol = getProtocolType(originCaip2Id);
  const baseToken = getToken(baseTokenCaip19Id);
  if (!baseToken) throw new Error(`No base token found for ${baseTokenCaip19Id}`);

  let weiAmount: string;
  if (DEFAULT_IGP_QUOTES[originProtocol]) {
    // If a default is set for the origin protocol, use that
    weiAmount = DEFAULT_IGP_QUOTES[originProtocol];
  } else {
    // Otherwise, compute IGP quote via the adapter
    adapter ||= AdapterFactory.HypTokenAdapterFromRouteOrigin(route);
    const destinationChainId = getChainReference(destinationCaip2Id);
    const destinationDomainId = getMultiProvider().getDomainId(destinationChainId);
    weiAmount = await adapter.quoteGasPayment(destinationDomainId);
  }

  // Determine the IGP token
  const isRouteFromBase = isRouteFromCollateral(route) || isIbcToWarpRoute(route);
  let type: IgpTokenType;
  let tokenCaip19Id: TokenCaip19Id;
  let tokenSymbol: string;
  let tokenDecimals: number;
  // If the token has an explicit IGP token address set, use that
  // Custom igpTokenAddress configs are supported only from the base (i.e. collateral) token is supported atm
  if (isRouteFromBase && baseToken.igpTokenAddress) {
    type = IgpTokenType.TokenSeparate;
    const igpToken = findTokensByAddress(baseToken.igpTokenAddress)[0];
    tokenCaip19Id = igpToken.tokenCaip19Id;
    // Note this assumes the u prefix because only cosmos tokens use this case
    tokenSymbol = igpToken.symbol;
    tokenDecimals = igpToken.decimals;
  } else if (originProtocol === ProtocolType.Cosmos) {
    // TODO Handle case of an evm-based token warped to cosmos
    if (!isRouteFromBase) throw new Error('IGP quote for cosmos synthetics not yet supported');
    // If the protocol is cosmos, use the base token
    type = IgpTokenType.TokenCombined;
    tokenCaip19Id = baseToken.tokenCaip19Id;
    tokenSymbol = baseToken.symbol;
    tokenDecimals = baseToken.decimals;
  } else {
    // Otherwise use the plain old native token from the route origin
    type = isRouteFromNative(route) ? IgpTokenType.NativeCombined : IgpTokenType.NativeSeparate;
    const originNativeToken = getChainMetadata(originCaip2Id).nativeToken;
    if (!originNativeToken) throw new Error(`No native token for ${originCaip2Id}`);
    tokenCaip19Id = getCaip19Id(
      originCaip2Id,
      AssetNamespace.native,
      getNativeTokenAddress(originProtocol),
    );
    tokenSymbol = originNativeToken.symbol;
    tokenDecimals = originNativeToken.decimals;
  }

  return {
    type,
    amount: fromWei(weiAmount, tokenDecimals),
    weiAmount,
    originCaip2Id,
    destinationCaip2Id,
    token: {
      tokenCaip19Id,
      symbol: tokenSymbol,
      decimals: tokenDecimals,
    },
  };
}
