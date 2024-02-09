import path from 'path';

import {
  EvmTokenAdapter,
  ITokenAdapter,
  MultiProtocolProvider,
  TokenType,
} from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import TokensJson from '../../consts/tokens.json';
import { tokenList as TokensTS } from '../../consts/tokens.ts';
import { getCaip2Id } from '../../features/caip/chains';
import {
  getCaip19Id,
  getNativeTokenAddress,
  resolveAssetNamespace,
} from '../../features/caip/tokens';
import { getHypErc20CollateralContract } from '../../features/tokens/contracts/evmContracts';
import {
  MinimalTokenMetadata,
  TokenMetadata,
  WarpTokenConfig,
  WarpTokenConfigSchema,
} from '../../features/tokens/types';
import { logger } from '../../utils/logger';

import { readYaml } from './utils';

export async function getProcessedTokenConfigs(multiProvider: MultiProtocolProvider) {
  const TokensYaml = readYaml(path.resolve(__dirname, '../../consts/tokens.yaml'));
  const tokenList = [...TokensJson, ...TokensYaml, ...TokensTS];
  const tokens = await parseTokenConfigs(multiProvider, tokenList);
  return tokens;
}

// Converts the more user-friendly config format into a validated, extended format
// that's easier for the UI to work with
async function parseTokenConfigs(
  multiProvider: MultiProtocolProvider,
  configList: WarpTokenConfig,
): Promise<TokenMetadata[]> {
  const result = WarpTokenConfigSchema.safeParse(configList);
  if (!result.success) {
    logger.warn('Invalid token config', result.error);
    throw new Error(`Invalid token config: ${result.error.toString()}`);
  }

  const parsedConfig = result.data;
  const tokenMetadata: TokenMetadata[] = [];
  for (const config of parsedConfig) {
    const { type, chainId, logoURI, igpTokenAddressOrDenom } = config;

    const protocol = multiProvider.getChainMetadata(chainId).protocol || ProtocolType.Ethereum;
    const chainCaip2Id = getCaip2Id(protocol, chainId);
    const isNative = type == TokenType.native;
    const isNft = type === TokenType.collateral && config.isNft;
    const isSpl2022 = type === TokenType.collateral && config.isSpl2022;
    const address =
      type === TokenType.collateral ? config.address : getNativeTokenAddress(protocol);
    const routerAddress =
      type === TokenType.collateral
        ? config.hypCollateralAddress
        : type === TokenType.native
        ? config.hypNativeAddress
        : '';
    const namespace = resolveAssetNamespace(protocol, isNative, isNft, isSpl2022);
    const tokenCaip19Id = getCaip19Id(chainCaip2Id, namespace, address);

    const { name, symbol, decimals } = await fetchNameAndDecimals(
      multiProvider,
      config,
      protocol,
      routerAddress,
      isNft,
    );

    tokenMetadata.push({
      name,
      symbol,
      decimals,
      logoURI,
      type,
      tokenCaip19Id,
      routerAddress,
      igpTokenAddressOrDenom,
    });
  }
  return tokenMetadata;
}

async function fetchNameAndDecimals(
  multiProvider: MultiProtocolProvider,
  tokenConfig: WarpTokenConfig[number],
  protocol: ProtocolType,
  routerAddress: Address,
  isNft?: boolean,
): Promise<MinimalTokenMetadata> {
  const { type, chainId, name, symbol, decimals } = tokenConfig;
  if (name && symbol && decimals) {
    // Already provided in the config
    return { name, symbol, decimals };
  }

  const chainMetadata = multiProvider.getChainMetadata(chainId);

  if (type === TokenType.native) {
    // Use the native token config that may be in the chain metadata
    const tokenMetadata = chainMetadata.nativeToken;
    if (!tokenMetadata) throw new Error('Name, symbol, or decimals is missing for native token');
    return tokenMetadata;
  }

  if (type === TokenType.collateral) {
    // Fetch the data from the contract
    let tokenAdapter: ITokenAdapter;
    if (protocol === ProtocolType.Ethereum) {
      const provider = multiProvider.getEthersV5Provider(chainId);
      const collateralContract = getHypErc20CollateralContract(routerAddress, provider);
      const wrappedTokenAddr = await collateralContract.wrappedToken();
      tokenAdapter = new EvmTokenAdapter(chainMetadata.name, multiProvider, {
        token: wrappedTokenAddr,
      });
    } else {
      // TODO solana support when hyp tokens have metadata
      throw new Error('Name, symbol, and decimals is required for non-EVM token configs');
    }
    return tokenAdapter.getMetadata(isNft);
  }

  throw new Error(`Unsupported token type ${type}`);
}
