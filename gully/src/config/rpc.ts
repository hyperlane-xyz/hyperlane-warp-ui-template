/**
 * GullyChain Testnet (485590) public RPCs, in fallback order (testnet-* subdomains, 2026-10-29):
 * 1. same-origin `/rpc`, only in the browser on a gullychain.xyz host (avoids ISP filtering of "testnet-" hostnames)
 * 2. testnet-rpc.gullychain.xyz (gully-l3 eRPC, canonical)
 * 3. rpc.gullyrpc.xyz keyless Gully RPC project (gully box, a different server)
 * 4. rpc2.gullychain.xyz (gully-l3, direct to the nodes)
 * rpc.gullychain.xyz is NOT listed: it becomes the mainnet (48559) RPC on cutover day.
 */
export const GULLY_PUBLIC_RPCS = [
  'https://testnet-rpc.gullychain.xyz',
  'https://rpc.gullyrpc.xyz/gullychain/evm/485590',
  'https://rpc2.gullychain.xyz',
] as const;

/**
 * rpcUrls handed to wallets (wallet_addEthereumChain): MetaMask uses rpcUrls[0], so the canonical URL goes first.
 * Same order as GULLY_PUBLIC_RPCS (all live since 2026-10-27).
 */
export const GULLY_WALLET_RPCS = [
  'https://testnet-rpc.gullychain.xyz',
  'https://rpc.gullyrpc.xyz/gullychain/evm/485590',
  'https://rpc2.gullychain.xyz',
] as const;

/**
 * Gully Chain MAINNET (48559) public RPCs, used only by the VITE_NETWORK=mainnet build: rpc.gullychain.xyz (the eRPC
 * edge on box A after the domain cutover, gully-ops l3/mainnet/INFRA.md) and the keyless Gully RPC project.
 */
export const GULLY_MAINNET_PUBLIC_RPCS = ['https://rpc.gullychain.xyz', 'https://rpc.gullyrpc.xyz/gullychain/evm/48559'] as const;
export const GULLY_MAINNET_WALLET_RPCS = [...GULLY_MAINNET_PUBLIC_RPCS] as const;

/** Fallback for the ETH/USD endpoint when the page is not served from a gullychain.xyz host. */
export const GULLY_PRICE_ORIGIN = 'https://gullychain.xyz';

interface Loc {
  origin: string;
  hostname: string;
}

const browserLoc = (): Loc | undefined => (typeof location !== 'undefined' ? location : undefined);

export const isGullyHost = (hostname: string) => hostname === 'gullychain.xyz' || hostname.endsWith('.gullychain.xyz');

/**
 * Ordered RPC list for app reads: env entries first (comma-separated; relative paths such as a dev proxy become
 * absolute), then same-origin /rpc on a gullychain.xyz host, then the public list. Duplicates are dropped.
 */
export function gullyRpcList(
  envValue?: string,
  loc: Loc | undefined = browserLoc(),
  publicRpcs: readonly string[] = GULLY_PUBLIC_RPCS,
  sameOriginRpc = true,
): string[] {
  const abs = (u: string) => (u.startsWith('/') && loc ? `${loc.origin}${u}` : u);
  const fromEnv = (envValue || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
    .map(abs)
    .filter((u) => /^https?:\/\//.test(u));
  // the mainnet build skips same-origin /rpc: on a gullychain.xyz host it is proxied to the testnet today
  const sameOrigin = sameOriginRpc && loc && isGullyHost(loc.hostname) ? [`${loc.origin}/rpc`] : [];
  return [...new Set([...fromEnv, ...sameOrigin, ...publicRpcs])];
}

/** ETH/USD endpoint: same-origin on a gullychain.xyz host, else gullychain.xyz. */
export function gullyPriceUrl(loc: Loc | undefined = browserLoc()): string {
  const origin = loc && isGullyHost(loc.hostname) ? loc.origin : GULLY_PRICE_ORIGIN;
  return `${origin}/price/eth`;
}
