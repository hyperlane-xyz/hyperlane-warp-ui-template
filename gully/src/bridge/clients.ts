import { createPublicClient, defineChain, fallback, http, type PublicClient, type Transport } from 'viem';

import { CHAINS, type ChainKey } from '../config/chains';

export function viemChain(key: ChainKey) {
  const c = CHAINS[key];
  return defineChain({
    id: c.id,
    name: c.name,
    nativeCurrency: { name: c.nativeSymbol === 'ETH' ? 'Ether' : c.nativeSymbol, symbol: c.nativeSymbol, decimals: c.nativeDecimals },
    rpcUrls: { default: { http: c.rpcs } },
    blockExplorers: { default: { name: 'Explorer', url: c.explorer } },
  });
}

/**
 * Every RPC of the chain behind viem fallback(): rank off keeps the configured order (first healthy wins, no ranking
 * pings), each URL gets 8 s and no retries of its own, the fallback retries the whole list once.
 */
export function rpcTransport(urls: readonly string[]): Transport {
  const one = (u: string) => http(u, { batch: { wait: 16 }, timeout: 8_000, retryCount: 0 });
  return urls.length === 1 ? http(urls[0], { batch: { wait: 16 }, timeout: 8_000, retryCount: 2 }) : fallback(urls.map(one), { rank: false, retryCount: 1 });
}

const cache = new Map<ChainKey, PublicClient>();
export function pub(key: ChainKey): PublicClient {
  if (CHAINS[key].protocol !== 'ethereum') throw new Error(`${CHAINS[key].name} is not an EVM chain`);
  let c = cache.get(key);
  if (!c) {
    c = createPublicClient({
      chain: viemChain(key),
      transport: rpcTransport(CHAINS[key].rpcs),
    }) as PublicClient;
    cache.set(key, c);
  }
  return c;
}
