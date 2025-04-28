import { Token } from '@hyperlane-xyz/sdk';

export function assembleTokensBySymbolMap(tokens: Token[]) {
  const multiChainTokens = tokens.filter((t) => t.isMultiChainToken());

  const tokensBySymbolMap: Record<string, Token[]> = multiChainTokens.reduce((acc, token) => {
    if (!acc[token.symbol]) {
      acc[token.symbol] = [];
    }
    acc[token.symbol].push(token);

    return acc;
  }, {});

  return tokensBySymbolMap;
}
