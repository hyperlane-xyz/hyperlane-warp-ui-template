#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

import { MultiProtocolProvider } from '@hyperlane-xyz/sdk';

import { type WarpContext, setWarpContext } from '../../context/context';
import { logger } from '../../utils/logger';

import { getProcessedChainConfigs } from './chains';
import { getRouteConfigs } from './routes';
import { getProcessedTokenConfigs } from './tokens';

const CHAINS_OUT_PATH = path.resolve(__dirname, '../../context/_chains.json');
const TOKENS_OUT_PATH = path.resolve(__dirname, '../../context/_tokens.json');
const ROUTES_OUT_PATH = path.resolve(__dirname, '../../context/_routes.json');

async function main() {
  logger.info('Getting chains');
  const chains = getProcessedChainConfigs();
  const multiProvider = new MultiProtocolProvider<{ mailbox?: Address }>(chains);
  logger.info('Getting tokens');
  const tokens = await getProcessedTokenConfigs(multiProvider);

  const context: WarpContext = {
    chains,
    tokens,
    routes: {},
    multiProvider,
  };
  setWarpContext(context);

  logger.info('Getting routes');
  const routes = await getRouteConfigs(context);

  logger.info(`Writing chains to file ${CHAINS_OUT_PATH}`);
  fs.writeFileSync(CHAINS_OUT_PATH, JSON.stringify(chains, null, 2), 'utf8');
  logger.info(`Writing tokens to file ${TOKENS_OUT_PATH}`);
  fs.writeFileSync(TOKENS_OUT_PATH, JSON.stringify(tokens, null, 2), 'utf8');
  logger.info(`Writing routes to file ${ROUTES_OUT_PATH}`);
  fs.writeFileSync(ROUTES_OUT_PATH, JSON.stringify(routes, null, 2), 'utf8');
}

main()
  .then(() => logger.info('Done processing configs'))
  .catch((error) => logger.warn('Error processing configs', error));
