import { chain } from 'wagmi';

import { ChainName, Chains, Mainnets } from '@hyperlane-xyz/sdk';

import { bscChain, chainIdToChain, chainIdToName, moonbaseAlphaChain } from '../consts/chains';
import { Environment } from '../consts/environments';

import { logger } from './logger';
import { toTitleCase } from './string';

export function getChainDisplayName(chainId?: number, shortName = false) {
  if (!chainId) return 'Unknown';
  if (shortName && chainId === bscChain.id) return 'Binance';
  if (shortName && chainId === moonbaseAlphaChain.id) return 'Moonbase';
  if (shortName && chainId === chain.optimismGoerli.id) return 'Opt. Goerli';
  if (shortName && chainId === chain.arbitrumGoerli.id) return 'Arb. Goerli';
  return toTitleCase(chainIdToChain[chainId]?.name || 'Unknown');
}

export function getChainEnvironment(chain: number | string) {
  let chainName: ChainName;
  if (typeof chain === 'number' && chainIdToName[chain]) {
    chainName = chainIdToName[chain];
  } else if (typeof chain === 'string' && Object.keys(Chains).includes(chain)) {
    chainName = chain as ChainName;
  } else {
    logger.error(`Cannot get environment for invalid chain ${chain}`);
    return Environment.Mainnet;
  }

  return Mainnets.includes(chainName) ? Environment.Mainnet : Environment.Testnet2;
}
