import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { ProtocolType } from '@hyperlane-xyz/utils';

import { COSM_IGP_QUOTE, SOL_IGP_QUOTE } from '../../consts/values';
import { getChainReference, getProtocolType } from '../caip/chains';
import {
  AssetNamespace,
  getCaip19Id,
  getChainIdFromToken,
  getNativeTokenAddress,
} from '../caip/tokens';
import { getChainMetadata, getMultiProvider } from '../multiProvider';
import { useStore } from '../store';
import { AdapterFactory } from '../tokens/AdapterFactory';
import { findTokensByAddress, getToken } from '../tokens/metadata';
import { Route } from '../tokens/routes/types';

const DEFAULT_IGP_QUOTES = {
  [ProtocolType.Sealevel]: SOL_IGP_QUOTE,
  [ProtocolType.Cosmos]: COSM_IGP_QUOTE,
};

export function useIgpQuote(route?: Route, enabled = true) {
  const setIgpQuote = useStore((state) => state.setIgpQuote);

  const {
    isLoading,
    isError: hasError,
    data,
  } = useQuery({
    queryKey: ['useIgpQuote', route],
    queryFn: async () => {
      if (!route) return null;
      const { baseTokenCaip19Id, originCaip2Id, destCaip2Id: destinationCaip2Id } = route;
      const originProtocol = getProtocolType(originCaip2Id);
      const baseToken = getToken(baseTokenCaip19Id);
      if (!baseToken) return null;

      let weiAmount: string;
      if (DEFAULT_IGP_QUOTES[originProtocol]) {
        // If a default is set for the origin protocol, use that
        weiAmount = DEFAULT_IGP_QUOTES[originProtocol];
      } else {
        // Otherwise, compute IGP quote via the adapter
        const adapter = AdapterFactory.HypTokenAdapterFromRouteOrigin(route);
        const destinationChainId = getChainReference(destinationCaip2Id);
        const destinationDomainId = getMultiProvider().getDomainId(destinationChainId);
        weiAmount = await adapter.quoteGasPayment(destinationDomainId);
      }

      // Determine the IGP token
      const baseTokenProtocol = getProtocolType(getChainIdFromToken(baseTokenCaip19Id));
      let igpTokenCaip19Id: TokenCaip19Id;
      let igpTokenSymbol: string;
      let igpTokenDecimals: number;
      if (baseToken.igpTokenAddress) {
        // If the token has an explicit IGP token address set, use that
        const igpToken = findTokensByAddress(baseToken.igpTokenAddress)[0];
        igpTokenCaip19Id = igpToken.tokenCaip19Id;
        // Note this assumes the u prefix because only cosmos tokens use this case
        igpTokenSymbol = `u${igpToken.symbol}`;
        igpTokenDecimals = igpToken.decimals;
      } else if (baseTokenProtocol === ProtocolType.Cosmos) {
        // If the protocol is cosmos, use the base token but with a u prefix
        igpTokenCaip19Id = baseToken.tokenCaip19Id;
        igpTokenSymbol = `u${baseToken.symbol}`;
        igpTokenDecimals = baseToken.decimals;
      } else {
        // Otherwise use the plain old native token from the route origin
        const originNativeToken = getChainMetadata(originCaip2Id).nativeToken;
        if (!originNativeToken) throw new Error(`No native token for ${originCaip2Id}`);
        igpTokenCaip19Id = getCaip19Id(
          originCaip2Id,
          AssetNamespace.native,
          getNativeTokenAddress(originProtocol),
        );
        igpTokenSymbol = originNativeToken.symbol;
        igpTokenDecimals = originNativeToken.decimals;
      }

      return {
        weiAmount,
        originCaip2Id,
        destinationCaip2Id,
        token: {
          tokenCaip19Id: igpTokenCaip19Id,
          symbol: igpTokenSymbol,
          decimals: igpTokenDecimals,
        },
      };
    },
    enabled,
  });

  useEffect(() => {
    setIgpQuote(data || null);
  }, [data, setIgpQuote]);

  return { isLoading, hasError, igpQuote: data };
}
