import { IToken, Token, WarpCore } from '@hyperlane-xyz/sdk';
import { isNullish } from '@hyperlane-xyz/utils';
import { useStore } from '../store';

export function useWarpCore() {
  return useStore((s) => s.warpCore);
}

export function useTokens() {
  return useWarpCore().tokens;
}

export function useTokenByIndex(tokenIndex?: number) {
  const warpCore = useWarpCore();
  return getTokenByIndex(warpCore, tokenIndex);
}

export function useIndexForToken(token?: IToken): number | undefined {
  const warpCore = useWarpCore();
  return getIndexForToken(warpCore, token);
}

export function getTokenByIndex(warpCore: WarpCore, tokenIndex?: number) {
  if (isNullish(tokenIndex) || tokenIndex >= warpCore.tokens.length) return undefined;
  return warpCore.tokens[tokenIndex];
}

export function getIndexForToken(warpCore: WarpCore, token?: IToken): number | undefined {
  if (!token) return undefined;
  const index = warpCore.tokens.indexOf(token as Token);
  if (index >= 0) return index;
  else return undefined;
}

export function tryFindToken(
  warpCore: WarpCore,
  chain: ChainName,
  addressOrDenom?: string,
): IToken | null {
  try {
    return warpCore.findToken(chain, addressOrDenom);
  } catch {
    return null;
  }
}

export function getTokenIndexFromChains(
  warpCore: WarpCore,
  addressOrDenom: string | null,
  origin: string,
  destination: string,
) {
  // find routes
  const tokensWithRoute = warpCore.getTokensForRoute(origin, destination);
  // find provided token addressOrDenom
  const queryToken = tokensWithRoute.find((token) => token.addressOrDenom === addressOrDenom);

  // if found return index
  if (queryToken) return getIndexForToken(warpCore, queryToken);
  // if tokens route has only one route return that index
  else if (tokensWithRoute.length === 1) return getIndexForToken(warpCore, tokensWithRoute[0]);
  // if 0 or more than 1 then return undefined
  return undefined;
}

export function getInitialTokenIndex(
  warpCore: WarpCore,
  addressOrDenom: string | null,
  originQuery?: string,
  destinationQuery?: string,
  defaultOriginToken?: Token,
  defaultDestinationChain?: string,
): number | undefined {
  const firstToken = defaultOriginToken || warpCore.tokens[0];
  const connectedToken = firstToken.connections?.[0].token;

  // origin query and destination query is defined
  if (originQuery && destinationQuery)
    return getTokenIndexFromChains(warpCore, addressOrDenom, originQuery, destinationQuery);

  // if none of those are defined, use default values and pass token query
  if (defaultDestinationChain || connectedToken) {
    return getTokenIndexFromChains(
      warpCore,
      addressOrDenom,
      firstToken.chainName,
      defaultDestinationChain || connectedToken?.chainName || '',
    );
  }

  return undefined;
}

export function tryFindTokenConnection(token: Token, chainName: string) {
  const connectedToken = token.connections?.find(
    (connection) => connection.token.chainName === chainName,
  );

  return connectedToken ? connectedToken.token : null;
}
