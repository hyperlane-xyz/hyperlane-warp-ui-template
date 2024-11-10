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
  const tokens = useTokens();
  if (isNullish(tokenIndex) || tokenIndex >= tokens.length) return undefined;
  return tokens[tokenIndex];
}

export function useIndexForToken(token?: IToken): number | undefined {
  const tokens = useTokens();
  if (!token) return undefined;
  const index = tokens.indexOf(token as Token);
  if (index >= 0) return index;
  else return undefined;
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
