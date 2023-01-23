import { BigNumber, providers } from 'ethers';

import { config } from '../consts/config';
import { getChainExplorerUrl } from '../features/chains/metadata';

import { logger } from './logger';
import { retryAsync } from './retry';
import { fetchWithTimeout } from './timeout';

export interface ExplorerQueryResponse<R> {
  status: string;
  message: string;
  result: R;
}

export function getTxExplorerUrl(chainId: number, hash?: string) {
  const baseUrl = getChainExplorerUrl(chainId);
  if (!hash || !baseUrl) return null;
  return `${baseUrl}/tx/${hash}`;
}

export async function queryExplorer<P>(chainId: number, path: string, useKey = true) {
  const baseUrl = getChainExplorerUrl(chainId, true);
  if (!baseUrl) throw new Error(`No URL found for explorer for chain ${chainId}`);

  let url = `${baseUrl}/${path}`;
  logger.debug('Querying explorer url:', url);

  if (useKey) {
    const apiKey = config.explorerApiKeys[chainId];
    if (!apiKey) throw new Error(`No API key for explorer for chain ${chainId}`);
    url += `&apikey=${apiKey}`;
  }

  const result = await retryAsync(() => executeQuery<P>(url), 2, 1000);
  return result;
}

async function executeQuery<P>(url: string) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Fetch response not okay: ${response.status}`);
  }
  const json = (await response.json()) as ExplorerQueryResponse<P>;

  if (!json.result) {
    const responseText = await response.text();
    throw new Error(`Invalid result format: ${responseText}`);
  }

  return json.result;
}

export interface ExplorerLogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  timeStamp: string;
  gasPrice: string;
  gasUsed: string;
  logIndex: string;
  transactionHash: string;
  transactionIndex: string;
}

export async function queryExplorerForLogs(
  chainId: number,
  path: string,
  topic0: string,
  useKey = true,
): Promise<ExplorerLogEntry[]> {
  const logs = await queryExplorer<ExplorerLogEntry[]>(chainId, path, useKey);
  if (!logs || !Array.isArray(logs)) {
    const msg = 'Invalid tx logs result';
    logger.error(msg, JSON.stringify(logs), path);
    throw new Error(msg);
  }
  logs.forEach((l) => validateExplorerLog(l, topic0));
  return logs;
}

export function validateExplorerLog(log: ExplorerLogEntry, topic0?: string) {
  if (!log) throw new Error('Log is nullish');
  if (!log.transactionHash) throw new Error('Log has no tx hash');
  if (!log.topics || !log.topics.length) throw new Error('Log has no topics');
  if (topic0 && log.topics[0]?.toLowerCase() !== topic0) throw new Error('Log topic is incorrect');
  if (!log.data) throw new Error('Log has no data to parse');
  if (!log.timeStamp) throw new Error('Log has no timestamp');
}

export async function queryExplorerForTx(chainId: number, txHash: string, useKey = true) {
  const path = `api?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}`;
  const tx = await queryExplorer<providers.TransactionResponse>(chainId, path, useKey);
  if (!tx || tx.hash.toLowerCase() !== txHash.toLowerCase()) {
    const msg = 'Invalid tx result';
    logger.error(msg, JSON.stringify(tx), path);
    throw new Error(msg);
  }
  return tx;
}

export async function queryExplorerForTxReceipt(chainId: number, txHash: string, useKey = true) {
  const path = `api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}`;
  const tx = await queryExplorer<providers.TransactionReceipt>(chainId, path, useKey);
  if (!tx || tx.transactionHash.toLowerCase() !== txHash.toLowerCase()) {
    const msg = 'Invalid tx result';
    logger.error(msg, JSON.stringify(tx), path);
    throw new Error(msg);
  }
  return tx;
}

export async function queryExplorerForBlock(
  chainId: number,
  blockNumber?: number | string,
  useKey = true,
) {
  const path = `api?module=proxy&action=eth_getBlockByNumber&tag=${
    blockNumber || 'latest'
  }&boolean=false`;
  const block = await queryExplorer<providers.Block>(chainId, path, useKey);
  if (!block || BigNumber.from(block.number).lte(0)) {
    const msg = 'Invalid block result';
    logger.error(msg, JSON.stringify(block), path);
    throw new Error(msg);
  }
  return block;
}
