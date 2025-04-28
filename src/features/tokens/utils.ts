import { ChainMap, Token } from '@hyperlane-xyz/sdk';

export type TokenChainMap = {
  chains: ChainMap<Token>;
  tokenInformation: Token;
};

export function assembleTokensBySymbolChainMap(tokens: Token[]): Record<string, TokenChainMap> {
  const multiChainTokens = tokens.filter((t) => t.isMultiChainToken());
  return multiChainTokens.reduce((acc, token) => {
    if (!acc[token.symbol]) {
      acc[token.symbol] = {
        chains: {},
        tokenInformation: token,
      };
    }
    if (!acc[token.symbol].chains[token.chainName]) {
      acc[token.symbol].chains[token.chainName] = token;
    }

    return acc;
  }, {});
}
