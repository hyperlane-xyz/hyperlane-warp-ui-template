import { ethers } from 'ethers';

import { TokenType } from '@hyperlane-xyz/hyperlane-token';

import { tokenList } from '../../consts/tokens';
import { logger } from '../../utils/logger';
import { getCaip2Id } from '../chains/caip2';
import { ProtocolType } from '../chains/types';

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
    const { type, protocol, chainId, name, symbol, decimals, logoURI } = token;
    const caip2Id = getCaip2Id(protocol || ProtocolType.Ethereum, chainId);
    const commonFields = { caip2Id, chainId, name, symbol, decimals, logoURI };
    if (type == TokenType.collateral) {
      tokenMetadata.push({
        ...commonFields,
        type: TokenType.collateral,
        tokenRouterAddress: token.hypCollateralAddress,
        address: token.address,
      });
    } else if (type == TokenType.native) {
      tokenMetadata.push({
        ...commonFields,
        type: TokenType.native,
        tokenRouterAddress: token.hypNativeAddress,
        // Note, using 0x000... address to help identify native tokens
        address: ethers.constants.AddressZero,
      });
    }
  }
  return tokenMetadata;
}
