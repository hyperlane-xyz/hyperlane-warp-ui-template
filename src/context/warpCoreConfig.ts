import { warpRouteConfigs } from '@hyperlane-xyz/registry';
import { WarpCoreConfig, WarpCoreConfigSchema } from '@hyperlane-xyz/sdk';
import { objFilter, objMerge } from '@hyperlane-xyz/utils';

import { warpRouteWhitelist } from '../consts/warpRouteWhitelist.ts';
import { warpRouteConfigs as WarpRoutesTs } from '../consts/warpRoutes.ts';
import WarpRoutesYaml from '../consts/warpRoutes.yaml';
import { validateZodResult } from '../utils/zod.ts';

export function assembleWarpCoreConfig(): WarpCoreConfig {
  const resultYaml = WarpCoreConfigSchema.safeParse(WarpRoutesYaml);
  const configYaml = validateZodResult(resultYaml, 'warp core yaml config');
  const resultTs = WarpCoreConfigSchema.safeParse(WarpRoutesTs);
  const configTs = validateZodResult(resultTs, 'warp core typescript config');

  const filteredWarpRouteConfigs = warpRouteWhitelist
    ? filterToIds(warpRouteConfigs, warpRouteWhitelist)
    : warpRouteConfigs;

  const configValues = Object.values(filteredWarpRouteConfigs);

  const configTokens = configValues.map((c) => c.tokens).flat();
  const tokens = dedupeTokens([...configTokens, ...configTs.tokens, ...configYaml.tokens]);

  if (!tokens.length)
    throw new Error(
      'No warp route configs provided. Please check your registry, warp route whitelist, and custom route configs for issues.',
    );

  const configOptions = configValues.map((c) => c.options).flat();
  const combinedOptions = [...configOptions, configTs.options, configYaml.options];
  const options = combinedOptions.reduce<WarpCoreConfig['options']>((acc, o) => {
    if (!o || !acc) return acc;
    for (const key of Object.keys(o)) {
      acc[key] = (acc[key] || []).concat(o[key] || []);
    }
    return acc;
  }, {});

  return { tokens, options };
}

function filterToIds(
  config: Record<string, WarpCoreConfig>,
  idWhitelist: string[],
): Record<string, WarpCoreConfig> {
  return objFilter(config, (id, c): c is WarpCoreConfig => idWhitelist.includes(id));
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
