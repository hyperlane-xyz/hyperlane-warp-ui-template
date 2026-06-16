import type { Token } from '@hyperlane-xyz/sdk';

import { WARP_QUERY_PARAMS } from '../../../consts/args';
import { config } from '../../../consts/config';
import { getQueryParams } from '../../../utils/queryParams';
import { getUnifiedRouteMode } from './routes';
import type { UnifiedToken } from './types';

export interface InitialUnifiedTokenKeys {
  originTokenKey: string | undefined;
  destinationTokenKey: string | undefined;
}

export function getInitialUnifiedTokenKeys({
  tokens,
  collateralGroups,
  engineEnabled,
}: {
  tokens: UnifiedToken[];
  collateralGroups: Map<string, Token[]>;
  engineEnabled: boolean;
}): InitialUnifiedTokenKeys {
  if (!tokens.length) return { originTokenKey: undefined, destinationTokenKey: undefined };

  const params = typeof window === 'undefined' ? undefined : getQueryParams();
  const originToken =
    findTokenFromParams(tokens, params, WARP_QUERY_PARAMS.ORIGIN, WARP_QUERY_PARAMS.ORIGIN_TOKEN) ??
    findTokenFromConfig(tokens, config.defaultOriginToken) ??
    findTokenFromConfig(tokens, config.defaultSwapOriginToken) ??
    findFirstOriginWithRoute(tokens, collateralGroups, engineEnabled) ??
    tokens[0];

  const destinationParamToken = findTokenFromParams(
    tokens,
    params,
    WARP_QUERY_PARAMS.DESTINATION,
    WARP_QUERY_PARAMS.DESTINATION_TOKEN,
  );
  const destinationToken =
    findRoutableToken(destinationParamToken, originToken, collateralGroups, engineEnabled) ??
    findRoutableConfigToken(
      tokens,
      config.defaultDestinationToken,
      originToken,
      collateralGroups,
      engineEnabled,
    ) ??
    findRoutableConfigToken(
      tokens,
      config.defaultSwapDestinationToken,
      originToken,
      collateralGroups,
      engineEnabled,
    ) ??
    findFirstRoutableDestination(originToken, tokens, collateralGroups, engineEnabled);

  return {
    originTokenKey: originToken?.key,
    destinationTokenKey: destinationToken?.key,
  };
}

function findTokenFromParams(
  tokens: UnifiedToken[],
  params: URLSearchParams | undefined,
  chainParam: WARP_QUERY_PARAMS,
  tokenParam: WARP_QUERY_PARAMS,
): UnifiedToken | undefined {
  const chainName = params?.get(chainParam);
  const tokenRef = params?.get(tokenParam);
  if (!chainName || !tokenRef) return undefined;
  return findToken(tokens, chainName, tokenRef);
}

function findTokenFromConfig(
  tokens: UnifiedToken[],
  configToken: string | undefined,
): UnifiedToken | undefined {
  const parsed = parseTokenRef(configToken);
  if (!parsed) return undefined;
  return findToken(tokens, parsed.chainName, parsed.tokenRef);
}

function findRoutableConfigToken(
  tokens: UnifiedToken[],
  configToken: string | undefined,
  originToken: UnifiedToken | undefined,
  collateralGroups: Map<string, Token[]>,
  engineEnabled: boolean,
): UnifiedToken | undefined {
  const token = findTokenFromConfig(tokens, configToken);
  return findRoutableToken(token, originToken, collateralGroups, engineEnabled);
}

function findRoutableToken(
  token: UnifiedToken | undefined,
  originToken: UnifiedToken | undefined,
  collateralGroups: Map<string, Token[]>,
  engineEnabled: boolean,
): UnifiedToken | undefined {
  if (!token || !originToken) return token;
  return getUnifiedRouteMode({
    originToken,
    destinationToken: token,
    collateralGroups,
    engineEnabled,
  })
    ? token
    : undefined;
}

function parseTokenRef(value: string | undefined): { chainName: string; tokenRef: string } | null {
  const separator = value?.indexOf('-') ?? -1;
  if (!value || separator <= 0) return null;
  return {
    chainName: value.slice(0, separator),
    tokenRef: value.slice(separator + 1),
  };
}

function findToken(
  tokens: UnifiedToken[],
  chainName: string,
  tokenRef: string,
): UnifiedToken | undefined {
  const normalizedChain = chainName.toLowerCase();
  const normalizedToken = tokenRef.toLowerCase();
  return tokens.find((token) => {
    if (token.chainName.toLowerCase() !== normalizedChain) return false;
    return (
      token.symbol.toLowerCase() === normalizedToken ||
      token.addressOrDenom.toLowerCase() === normalizedToken ||
      token.bridgeToken?.addressOrDenom.toLowerCase() === normalizedToken ||
      token.bridgeToken?.collateralAddressOrDenom?.toLowerCase() === normalizedToken ||
      token.swapToken?.address.toLowerCase() === normalizedToken
    );
  });
}

function findFirstOriginWithRoute(
  tokens: UnifiedToken[],
  collateralGroups: Map<string, Token[]>,
  engineEnabled: boolean,
): UnifiedToken | undefined {
  return tokens.find((originToken) =>
    tokens.some(
      (destinationToken) =>
        destinationToken.chainName !== originToken.chainName &&
        !!getUnifiedRouteMode({ originToken, destinationToken, collateralGroups, engineEnabled }),
    ),
  );
}

function findFirstRoutableDestination(
  originToken: UnifiedToken | undefined,
  tokens: UnifiedToken[],
  collateralGroups: Map<string, Token[]>,
  engineEnabled: boolean,
): UnifiedToken | undefined {
  if (!originToken) return undefined;
  return tokens.find(
    (destinationToken) =>
      destinationToken.chainName !== originToken.chainName &&
      !!getUnifiedRouteMode({ originToken, destinationToken, collateralGroups, engineEnabled }),
  );
}
