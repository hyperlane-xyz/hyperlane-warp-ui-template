import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { IHypTokenAdapter } from '@hyperlane-xyz/sdk';
import { ProtocolType, fromWei, isAddress } from '@hyperlane-xyz/utils';

import { useToastError } from '../../components/toast/useToastError';
import { DEFAULT_IGP_QUOTES } from '../../consts/igpQuotes';
import { getChainReference, parseCaip2Id } from '../caip/chains';
import { AssetNamespace, getCaip19Id, getNativeTokenAddress } from '../caip/tokens';
import { getChainMetadata, getMultiProvider } from '../multiProvider';
import { Route } from '../routes/types';
import {
  isIbcOnlyRoute,
  isIbcToWarpRoute,
  isRouteFromCollateral,
  isRouteFromNative,
} from '../routes/utils';
import { useStore } from '../store';
import { AdapterFactory } from '../tokens/AdapterFactory';
import { findTokensByAddress, getToken } from '../tokens/metadata';

import { IgpQuote, IgpTokenType } from './types';

export function useIgpQuote(route?: Route) {
  const setIgpQuote = useStore((state) => state.setIgpQuote);

  const { isLoading, isError, error, data } = useQuery({
    queryKey: ['useIgpQuote', route],
    queryFn: () => {
      if (!route || isIbcOnlyRoute(route)) return null;
      return fetchIgpQuote(route);
    },
  });

  useEffect(() => {
    setIgpQuote(data || null);
  }, [data, setIgpQuote]);

  useToastError(error, 'Error fetching IGP quote');

  return { isLoading, isError, igpQuote: data };
}

export async function fetchIgpQuote(route: Route, adapter?: IHypTokenAdapter): Promise<IgpQuote> {
  const { baseTokenCaip19Id, originCaip2Id, destCaip2Id: destinationCaip2Id } = route;
  const { protocol: originProtocol, reference: originChainId } = parseCaip2Id(originCaip2Id);
  const baseToken = getToken(baseTokenCaip19Id);
  if (!baseToken) throw new Error(`No base token found for ${baseTokenCaip19Id}`);

  let weiAmount: string;
  const defaultQuotes = DEFAULT_IGP_QUOTES[originProtocol];
  if (typeof defaultQuotes === 'string') {
    weiAmount = defaultQuotes;
  } else if (defaultQuotes?.[originChainId]) {
    weiAmount = defaultQuotes[originChainId];
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
  if (
    isRouteFromBase &&
    baseToken.igpTokenAddressOrDenom &&
    isAddress(baseToken.igpTokenAddressOrDenom)
  ) {
    type = IgpTokenType.TokenSeparate;
    const igpToken = findTokensByAddress(baseToken.igpTokenAddressOrDenom)[0];
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
