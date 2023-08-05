import { TokenType } from '@hyperlane-xyz/hyperlane-token';
import { ProtocolType } from '@hyperlane-xyz/sdk';

import { tokenList } from '../../consts/tokens';
import { logger } from '../../utils/logger';
import { getCaip2Id } from '../caip/chains';
import { getCaip19Id, getNativeTokenAddress, resolveAssetNamespace } from '../caip/tokens';

import { TokenMetadata, WarpTokenConfig, WarpTokenConfigSchema } from './types';

let tokens: TokenMetadata[];

export function getAllTokens() {
  if (!tokens) {
    tokens = parseTokenConfigs(tokenList);
  }
  return tokens;
}

export function getToken(caip19Id: Caip19Id) {
  return getAllTokens().find((t) => t.caip19Id === caip19Id);
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
    const { type, chainId, name, symbol, decimals, logoURI } = token;
    const protocol = token.protocol || ProtocolType.Ethereum;
    const caip2Id = getCaip2Id(protocol, chainId);
    const isNft = type === TokenType.collateral && token.isNft;
    const isSpl2022 = type === TokenType.collateral && token.isSpl2022;
    const address = type === TokenType.collateral ? token.address : getNativeTokenAddress(protocol);
    const routerAddress =
      type === TokenType.collateral ? token.hypCollateralAddress : token.hypNativeAddress;
    const namespace = resolveAssetNamespace(protocol, type == TokenType.native, isNft, isSpl2022);
    const caip19Id = getCaip19Id(caip2Id, namespace, address);
    tokenMetadata.push({
      chainId,
      name,
      symbol,
      decimals,
      logoURI,
      type,
      caip19Id,
      routerAddress,
    });
  }
  return tokenMetadata;
}
