import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { ProtocolType } from '@hyperlane-xyz/utils';

import { getChainReference, getProtocolType } from '../caip/chains';
import { getMultiProvider } from '../multiProvider';
import { useStore } from '../store';
import { AdapterFactory } from '../tokens/AdapterFactory';
import { Route } from '../tokens/routes/types';

const NON_EVM_IGP_QUOTE = '10000';

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

      const originProtocol = getProtocolType(route.originCaip2Id);
      if (originProtocol !== ProtocolType.Ethereum)
        return {
          weiAmount: NON_EVM_IGP_QUOTE,
          originCaip2Id: route.originCaip2Id,
          destinationCaip2Id: route.destCaip2Id,
        };

      const adapter = AdapterFactory.HypTokenAdapterFromRouteOrigin(route);
      const destinationChainId = getChainReference(route.destCaip2Id);
      const destinationDomainId = getMultiProvider().getDomainId(destinationChainId);
      const weiAmount = await adapter.quoteGasPayment(destinationDomainId);
      return {
        weiAmount,
        originCaip2Id: route.originCaip2Id,
        destinationCaip2Id: route.destCaip2Id,
      };
    },
    enabled,
  });

  useEffect(() => {
    setIgpQuote(data || null);
  }, [data, setIgpQuote]);

  return { isLoading, hasError, igpQuote: data };
}
