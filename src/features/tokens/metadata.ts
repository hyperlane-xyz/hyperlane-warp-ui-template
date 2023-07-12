import { TokenType } from '@hyperlane-xyz/hyperlane-token';
import { ProtocolType } from '@hyperlane-xyz/sdk';

import { tokenList } from '../../consts/tokens';
import { logger } from '../../utils/logger';
import { getCaip2Id } from '../chains/caip2';

import { getNativeTokenAddress } from './native';
import { TokenMetadata, WarpTokenConfig, WarpTokenConfigSchema } from './types';

let tokens: TokenMetadata[];

export function getAllTokens() {
  if (!tokens) {
    tokens = parseTokenConfigs(tokenList);
  }
  return tokens;
}

function parseTokenConfigs(configList: WarpTokenConfig): TokenMetadata[] {
  const result = WarpTokenConfigSchema.safeParse(configList);
  if (!result.success) {
    logger.error('Invalid token config', result.error);
    throw new Error(`Invalid token config: ${result.error.toString()}`);
  }

  const parsedConfig = result.data;
  const tokenMetadata: TokenMetadata[] = [];
  for (const token of parsedConfig) {
    const {
      type,
      protocol = ProtocolType.Ethereum,
      chainId,
      name,
      symbol,
      decimals,
      logoURI,
    } = token;
    const caip2Id = getCaip2Id(protocol, chainId);
    const commonFields = { caip2Id, chainId, name, symbol, decimals, logoURI };
    if (type == TokenType.collateral) {
      tokenMetadata.push({
        ...commonFields,
        type: TokenType.collateral,
        tokenRouterAddress: token.hypCollateralAddress,
        address: token.address,
        isNft: !!token.isNft,
      });
    } else if (type == TokenType.native) {
      tokenMetadata.push({
        ...commonFields,
        type: TokenType.native,
        tokenRouterAddress: token.hypNativeAddress,
        address: getNativeTokenAddress(protocol),
      });
    }
  }
  return tokenMetadata;
}
