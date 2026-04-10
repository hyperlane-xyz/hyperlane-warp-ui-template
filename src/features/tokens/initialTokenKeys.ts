import type { MultiProviderAdapter as MultiProtocolProvider } from '@hyperlane-xyz/sdk/providers/MultiProviderAdapter';
import type { Token } from '@hyperlane-xyz/sdk/token/Token';

import { WARP_QUERY_PARAMS } from '../../consts/args';
import { config } from '../../consts/config';
import { getQueryParams } from '../../utils/queryParams';
import { tryGetValidChainName } from '../chains/utils';
import { getTokenKey } from './utils';

function findTokenByChainSymbol(tokens: Token[], chainSymbol: string): Token | undefined {
  const [chainName, symbol] = chainSymbol.split('-');
  if (!chainName || !symbol) return undefined;
  return tokens.find(
    (t) => t.chainName === chainName && t.symbol.toLowerCase() === symbol.toLowerCase(),
  );
}

export function getInitialTokenKeys(
  multiProvider: MultiProtocolProvider,
  tokens: Token[],
): { originTokenKey: string | undefined; destinationTokenKey: string | undefined } {
  if (tokens.length === 0) {
    return { originTokenKey: undefined, destinationTokenKey: undefined };
  }

  const params = getQueryParams();
  const originChainQuery = tryGetValidChainName(
    params.get(WARP_QUERY_PARAMS.ORIGIN),
    multiProvider,
  );
  const destinationChainQuery = tryGetValidChainName(
    params.get(WARP_QUERY_PARAMS.DESTINATION),
    multiProvider,
  );
  const originTokenSymbol = params.get(WARP_QUERY_PARAMS.ORIGIN_TOKEN);
  const destinationTokenSymbol = params.get(WARP_QUERY_PARAMS.DESTINATION_TOKEN);

  let originToken: Token | undefined;
  if (originChainQuery && originTokenSymbol) {
    originToken = tokens.find(
      (t) =>
        t.chainName === originChainQuery &&
        t.symbol.toLowerCase() === originTokenSymbol.toLowerCase(),
    );
  }

  if (!originToken && config.defaultOriginToken) {
    originToken = findTokenByChainSymbol(tokens, config.defaultOriginToken);
  }

  if (!originToken && config.featuredTokens.length > 0) {
    for (const featuredToken of config.featuredTokens) {
      const candidate = findTokenByChainSymbol(tokens, featuredToken);
      if (candidate?.connections?.length) {
        originToken = candidate;
        break;
      }
    }
  }

  if (!originToken) {
    originToken = tokens.find((t) => t.connections && t.connections.length > 0);
  }

  let destinationToken: Token | undefined;
  if (destinationChainQuery && destinationTokenSymbol) {
    destinationToken = tokens.find(
      (t) =>
        t.chainName === destinationChainQuery &&
        t.symbol.toLowerCase() === destinationTokenSymbol.toLowerCase(),
    );
  }

  if (!destinationToken && config.defaultDestinationToken) {
    destinationToken = findTokenByChainSymbol(tokens, config.defaultDestinationToken);
  }

  if (!destinationToken && originToken) {
    const firstConnection = originToken.connections?.[0];
    const connectedChain = firstConnection?.token?.chainName;
    const connectedSymbol = firstConnection?.token?.symbol;
    destinationToken = connectedChain
      ? tokens.find(
          (t) =>
            t.chainName === connectedChain &&
            t.symbol.toLowerCase() === connectedSymbol?.toLowerCase(),
        )
      : undefined;
  }

  return {
    originTokenKey: originToken ? getTokenKey(originToken) : undefined,
    destinationTokenKey: destinationToken ? getTokenKey(destinationToken) : undefined,
  };
}
