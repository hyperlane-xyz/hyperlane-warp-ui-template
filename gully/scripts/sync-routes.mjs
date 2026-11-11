// Builds src/config/routes.json from a Hyperlane registry overlay (gully-ops l3/hyperlane/registry) and the multi-chain
// manifest (gully-ops l3/hyperlane/multichain/routes.yaml, next to the registry).
//
// 1. Classic routes (the live lanes with Arbitrum Sepolia): every deployments/warp_routes/<SYMBOL>/<chains>-config.yaml
//    that connects arbitrumsepolia and gullychaintestnet and is NOT a manifest route. The default is the native ETH route
//    (HypNative on GullyChain: users get gas ETH) when its config exists, else gETH, else the first one. Every other
//    classic route is written with "legacy": true: never offered for deposits, only to redeem a balance someone still
//    holds (GullyChain -> Arbitrum Sepolia), so nothing is stranded.
// 2. Multi-chain routes: every route of the manifest's network (ETH, USDC, USDT, BNB, SOL, USDC-SOL). When the Hyperlane
//    CLI has written deployments/warp_routes/<route id>-config.yaml (after the owner deploys), router addresses come
//    from it, EVM and Sealevel alike (SealevelHypNative / SealevelHypCollateral, base58 addresses). Until then a route is
//    written with "deployed": false and "address": null per token: the UI shows it as "Coming soon".
//
//   node scripts/sync-routes.mjs [registry-dir] [--manifest <routes.yaml>] [--network testnet|mainnet]
// Default registry dir: ../../gully-ops/l3/hyperlane/registry next to this repo, or GULLY_REGISTRY.
// Default manifest: <registry>/../multichain/routes.yaml (or GULLY_MANIFEST); missing manifest = classic routes only.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'yaml';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const manifestArg = opt('--manifest');
const network = opt('--network') || process.env.GULLY_NETWORK || 'testnet';
const reg = resolve(args[0] || process.env.GULLY_REGISTRY || '../../gully-ops/l3/hyperlane/registry');
const dir = join(reg, 'deployments/warp_routes');
if (!existsSync(dir)) throw new Error(`no warp_routes in ${reg}`);
const manifestPath = resolve(manifestArg || process.env.GULLY_MANIFEST || join(dirname(reg), 'multichain/routes.yaml'));

// ---- manifest (optional) ----
let net = null;
if (existsSync(manifestPath)) {
  const m = parse(readFileSync(manifestPath, 'utf8'));
  net = m?.networks?.[network] || null;
  if (!net) throw new Error(`manifest ${manifestPath} has no network "${network}"`);
}
const GULLY = net?.gully || 'gullychaintestnet';
const manifestIds = new Set(Object.values(net?.routes || {}).map((r) => r.id));

const tokenOf = (t) => ({
  address: t.addressOrDenom,
  standard: t.standard,
  tokenType: t.tokenType,
  symbol: t.symbol,
  name: t.name,
  decimals: t.decimals,
  collateralAddress: t.collateralAddressOrDenom || null,
  ...(t.scale !== undefined ? { scale: t.scale } : {}),
});

// ---- 1. classic routes ----
const CHAINS = ['arbitrumsepolia', 'gullychaintestnet'];
// rank: native GullyChain token first (2026-10-28), then gETH
const rank = (r) => (r.tokens.gullychaintestnet.tokenType === 'native' ? 2 : r.tokens.gullychaintestnet.symbol === 'gETH' ? 1 : 0);
const routes = [];
for (const sym of readdirSync(dir).sort()) {
  if (!statSync(join(dir, sym)).isDirectory()) continue;
  for (const f of readdirSync(join(dir, sym)).filter((f) => f.endsWith('-config.yaml')).sort()) {
    const id = `${sym}/${f.replace(/-config\.yaml$/, '')}`;
    if (manifestIds.has(id)) continue;
    const cfg = parse(readFileSync(join(dir, sym, f), 'utf8'));
    const tokens = Object.fromEntries(
      (cfg.tokens || []).filter((t) => CHAINS.includes(t.chainName)).map((t) => [t.chainName, tokenOf(t)]),
    );
    if (!CHAINS.every((c) => tokens[c])) continue;
    // classic tokens never carry a scale field (kept identical to the pre-multichain output)
    for (const c of CHAINS) delete tokens[c].scale;
    routes.push({ id, symbol: sym, tokens });
  }
}
if (!routes.length) throw new Error('no arbitrumsepolia <-> gullychaintestnet warp route found');
routes.sort((a, b) => rank(b) - rank(a));
routes.forEach((r, i) => {
  if (i > 0) r.legacy = true;
});
// mirror routes: the GullyChain-side token is minted on Gully Chain (synthetic/collateral, not native); the UI shows the
// "Powered by Gully Core" badge (brand kit v4) on them
routes.forEach((r) => {
  if (r.tokens.gullychaintestnet.tokenType !== 'native') r.mirror = true;
});

// ---- 2. multi-chain routes ----
const chains = {};
const multichain = [];
if (net) {
  for (const [key, c] of Object.entries(net.chains || {})) {
    chains[key] = {
      protocol: c.protocol,
      domain: c.domain,
      name: c.name,
      logo: c.logo,
      explorer: c.explorer,
      nativeSymbol: c.nativeSymbol,
      ...(c.faucet ? { faucet: c.faucet } : {}),
      ...(c.canonical ? { canonical: true } : {}),
    };
  }
  for (const [key, r] of Object.entries(net.routes || {})) {
    const file = join(dir, `${r.id}-config.yaml`);
    const deployedCfg = existsSync(file) ? parse(readFileSync(file, 'utf8')) : null;
    const deployed = Object.fromEntries((deployedCfg?.tokens || []).map((t) => [t.chainName, tokenOf(t)]));
    const planned = (chain, leg) => ({
      address: null,
      standard: null,
      tokenType: leg.type,
      symbol: leg.type === 'native' ? chains[chain]?.nativeSymbol || r.symbol : r.symbol,
      name: r.name,
      decimals: leg.decimals ?? r.decimals,
      collateralAddress: leg.token || null,
    });
    const tokens = {};
    for (const [chain, leg] of [[GULLY, r.gully], ...Object.entries(r.legs || {})]) {
      tokens[chain] = deployed[chain] || planned(chain, leg);
    }
    multichain.push({ id: r.id, key, symbol: r.symbol, name: r.name, deployed: !!deployedCfg, tokens });
  }
}

const out = {
  generatedFrom: 'gully-ops l3/hyperlane/registry/deployments/warp_routes',
  defaultRouteId: routes[0].id,
  routes,
  ...(net
    ? {
        network,
        gully: GULLY,
        multichainFrom: 'gully-ops l3/hyperlane/multichain/routes.yaml',
        chains,
        multichain,
      }
    : {}),
};
// GULLY_ROUTES_OUT: write somewhere else (tests); default src/config/routes.json
const outFile = process.env.GULLY_ROUTES_OUT ? resolve(process.env.GULLY_ROUTES_OUT) : new URL('../src/config/routes.json', import.meta.url);
writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
console.log(`routes.json: ${routes.map((r) => r.id).join(', ')} (default ${out.defaultRouteId})`);
if (net)
  console.log(
    `multichain (${network}): ${multichain.map((r) => `${r.key}${r.deployed ? '' : ' (planned)'}`).join(', ')}`,
  );
