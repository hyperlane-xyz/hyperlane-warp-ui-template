import {
  IRegistry,
  warpRouteConfigs as publishedRegistryWarpRoutes,
} from '@hyperlane-xyz/registry';
import {
  TOKEN_STANDARD_TO_PROTOCOL,
  WarpCoreConfig,
  WarpCoreConfigSchema,
  getTokenConnectionId,
  validateZodResult,
} from '@hyperlane-xyz/sdk';
import { isObjEmpty, objFilter, objMerge } from '@hyperlane-xyz/utils';
import { config } from '../../consts/config.ts';
import { warpRouteWhitelist } from '../../consts/warpRouteWhitelist.ts';
import { warpRouteConfigs as tsWarpRoutes } from '../../consts/warpRoutes.ts';
import yamlWarpRoutes from '../../consts/warpRoutes.yaml';
import { logger } from '../../utils/logger.ts';

export async function assembleWarpCoreConfig(
  storeOverrides: WarpCoreConfig[],
  registry: IRegistry,
): Promise<WarpCoreConfig> {
  const yamlResult = WarpCoreConfigSchema.safeParse(yamlWarpRoutes);
  const yamlConfig = validateZodResult(yamlResult, 'warp core yaml config');
  const tsResult = WarpCoreConfigSchema.safeParse(tsWarpRoutes);
  const tsConfig = validateZodResult(tsResult, 'warp core typescript config');

  let registryWarpRoutes: Record<string, WarpCoreConfig>;

  try {
    if (config.registryUrl) {
      logger.debug('Using custom registry warp routes from:', config.registryUrl);
      registryWarpRoutes = await registry.getWarpRoutes();
      if (isObjEmpty(registryWarpRoutes)) throw new Error('Warp routes empty');
    } else {
      throw new Error('No custom registry URL provided');
    }
  } catch {
    logger.debug('Using default published registry for warp routes');
    registryWarpRoutes = publishedRegistryWarpRoutes;
  }

  const filteredRegistryConfigMap = warpRouteWhitelist
    ? filterToIds(registryWarpRoutes, warpRouteWhitelist)
    : registryWarpRoutes;
  const filteredRegistryConfigValues = Object.values(filteredRegistryConfigMap);
  const filteredRegistryTokens = filteredRegistryConfigValues.map((c) => c.tokens).flat();
  const filteredRegistryOptions = filteredRegistryConfigValues.map((c) => c.options).flat();

  const storeOverrideTokens = storeOverrides.map((c) => c.tokens).flat();
  const storeOverrideOptions = storeOverrides.map((c) => c.options).flat();

  const combinedTokens = [
    ...filteredRegistryTokens,
    ...tsConfig.tokens,
    ...yamlConfig.tokens,
    ...storeOverrideTokens,
  ];
  const tokens = filterUnconnectedToken(dedupeTokens(combinedTokens));

  const combinedOptions = [
    ...filteredRegistryOptions,
    tsConfig.options,
    yamlConfig.options,
    ...storeOverrideOptions,
  ];
  const options = reduceOptions(combinedOptions);

  if (!tokens.length)
    throw new Error(
      'No warp route configs provided. Please check your registry, warp route whitelist, and custom route configs for issues.',
    );

  return { tokens, options };
}

function filterToIds(
  config: Record<string, WarpCoreConfig>,
  idWhitelist: string[],
): Record<string, WarpCoreConfig> {
  return objFilter(config, (id, c): c is WarpCoreConfig =>
    idWhitelist.map((id) => id.toUpperCase()).includes(id.toUpperCase()),
  );
}

// Separate warp configs may contain duplicate definitions of the same token.
// E.g. an IBC token that gets used for interchain gas in many different routes.
function dedupeTokens(tokens: WarpCoreConfig['tokens']): WarpCoreConfig['tokens'] {
  const idToToken: Record<string, WarpCoreConfig['tokens'][number]> = {};
  for (const token of tokens) {
    const id = `${token.chainName}|${token.addressOrDenom?.toLowerCase()}`;
    idToToken[id] = objMerge(idToToken[id] || {}, token);
  }
  return Object.values(idToToken);
}

// Combine a list of WarpCore option objects into one single options object
function reduceOptions(optionsList: Array<WarpCoreConfig['options']>): WarpCoreConfig['options'] {
  return optionsList.reduce<WarpCoreConfig['options']>((acc, o) => {
    if (!o || !acc) return acc;
    for (const key of Object.keys(o)) {
      acc[key] = (acc[key] || []).concat(o[key] || []);
    }
    return acc;
  }, {});
}

// Remove tokens that have no connections from the token list, but preserve tokens that are destinations
function filterUnconnectedToken(tokens: WarpCoreConfig['tokens']): WarpCoreConfig['tokens'] {
  const destinationTokenIds = new Set<string>();

  tokens.forEach((token) => {
    if (token.connections?.length) {
      token.connections.forEach((conn) => {
        destinationTokenIds.add(conn.token);
      });
    }
  });

  // Keep tokens with connections OR tokens that are destinations
  return tokens.filter((token) => {
    // remove null addresses if they exist
    if (!token.addressOrDenom) return false;
    // Has connections - keep it
    if (token.connections?.length) return true;

    const protocol = TOKEN_STANDARD_TO_PROTOCOL[token.standard];

    // Is a destination token - keep it
    const tokenId = getTokenConnectionId(protocol, token.chainName, token.addressOrDenom);
    return destinationTokenIds.has(tokenId);
  });
}
