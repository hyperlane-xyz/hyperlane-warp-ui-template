import { WarpCoreConfig, WarpCoreConfigSchema } from '@hyperlane-xyz/sdk';

import TokensJson from '../consts/tokens.json';
import { tokenConfigs as TokensTS } from '../consts/tokens.ts';
import TokensYaml from '../consts/tokens.yaml';
import { validateZodResult } from '../utils/zod.ts';

export function getWarpCoreConfig(): WarpCoreConfig {
  const resultJson = WarpCoreConfigSchema.safeParse(TokensJson);
  const configJson = validateZodResult(resultJson, 'warp core json config');
  const resultYaml = WarpCoreConfigSchema.safeParse(TokensYaml);
  const configYaml = validateZodResult(resultYaml, 'warp core yaml config');
  const resultTs = WarpCoreConfigSchema.safeParse(TokensTS);
  const configTs = validateZodResult(resultTs, 'warp core typescript config');

  const tokens = [...configTs.tokens, ...configJson.tokens, ...configYaml.tokens];
  const options = { ...configTs.options, ...configJson.options, ...configYaml.options };
  return { tokens, options };
}
