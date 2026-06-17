import type { Token } from '@hyperlane-xyz/sdk';

import { WARP_QUERY_PARAMS } from '../../../consts/args';
import { config } from '../../../consts/config';
import { getQueryParams } from '../../../utils/queryParams';
import { findUnifiedTokenByConfigRef, findUnifiedTokenByQueryRef } from './queryParams';
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
    );

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
  return findUnifiedTokenByQueryRef(tokens, chainName, tokenRef);
}

function findTokenFromConfig(
  tokens: UnifiedToken[],
  configToken: string | undefined,
): UnifiedToken | undefined {
  const parsed = parseTokenRef(configToken);
  if (!parsed) return undefined;
  return findUnifiedTokenByConfigRef(tokens, parsed.chainName, parsed.tokenRef);
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
