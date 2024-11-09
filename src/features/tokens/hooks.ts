import { IToken, Token } from '@hyperlane-xyz/sdk';
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
