import { warpRouteWhitelist } from '../../src/consts/warpRouteWhitelist';

// Picks known-good warp route IDs for embed ?routes= tests.
// Prefers whitelist entries on prod branches; falls back to registry routes on main.
export function resolveTestRoutes(): { primary: string; secondary: string; skip: boolean } {
  if (warpRouteWhitelist === null) {
    return { primary: 'USDC/aleo', secondary: 'ETH/aleo', skip: false };
  }
  if (warpRouteWhitelist.length === 0) {
    return { primary: '', secondary: '', skip: true };
  }
  return {
    primary: warpRouteWhitelist[0],
    secondary: warpRouteWhitelist[1] ?? warpRouteWhitelist[0],
    skip: false,
  };
}

// Mirrors ChainList's rendered label (`chain.displayName || chain.name`, see
// src/features/chains/hooks.ts:52). Can't import the source `getChainDisplayName`
// directly because its file transitively pulls in @hyperlane-xyz/registry,
// whose barrel includes aleo/@provablehq/wasm TLA and breaks Playwright's CJS
// test loader.
export async function resolveChainDisplayName(slug: string): Promise<string> {
  const { chainMetadata } = await import('@hyperlane-xyz/registry');
  const metadata = chainMetadata[slug];
  return metadata?.displayName || metadata?.name || slug;
}

export async function isTestnetChain(slug: string): Promise<boolean> {
  const { chainMetadata } = await import('@hyperlane-xyz/registry');
  return !!chainMetadata[slug]?.isTestnet;
}
