// Production static build of the Gully Bridge (direction C) into a staging folder ready to copy to the box:
//   node scripts/build-staging.mjs [outDir]                      testnet (default)
//   BRIDGE_NETWORK=mainnet node scripts/build-staging.mjs [outDir] Gully Chain mainnet (48559 on Arbitrum One):
//     mainnet addresses from src/config/mainnet.json or VITE_MAINNET_* in the env (lanes stay closed until set);
//     the build is MAINNET_BRIDGE_DIST for gully-ops scripts/mainnet/domain-cutover.sh (bridge.gullychain.xyz).
// Default outDir: ./staging/testnet-bridge.gullychain.xyz  (deploy target: /srv/status/sites/testnet-bridge.gullychain.xyz)
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const mainnet = (process.env.BRIDGE_NETWORK || 'testnet') === 'mainnet';
if (!['testnet', 'mainnet'].includes(process.env.BRIDGE_NETWORK || 'testnet')) throw new Error('BRIDGE_NETWORK must be testnet or mainnet');
const host = mainnet ? 'bridge.gullychain.xyz' : 'testnet-bridge.gullychain.xyz';
const NET = {
  testnet: { VITE_NETWORK: 'testnet', VITE_SITE_URL: 'https://testnet-bridge.gullychain.xyz/', VITE_ARB_RPC: 'https://sepolia-rollup.arbitrum.io/rpc' },
  mainnet: { VITE_NETWORK: 'mainnet', VITE_SITE_URL: 'https://bridge.gullychain.xyz/', VITE_ARB_RPC: 'https://arb1.arbitrum.io/rpc' },
}[mainnet ? 'mainnet' : 'testnet'];
const out = resolve(process.argv[2] || `staging/${host}`);
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '-p', '.'], { stdio: 'inherit' });
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'production'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DIRECTION: 'c',
    VITE_OUT_DIR: out,
    ...NET,
    // VITE_GULLY_RPC unset: same-origin /rpc, then the public fallback list in src/config/rpc.ts
    VITE_GULLY_RPC: '',
    VITE_ROBOTS: 'index, follow',
  },
});
// the first screen in the first response, the service worker, then the gate: a page that fails it does not ship
const buildEnv = { ...process.env, VITE_DIRECTION: 'c', ...NET, VITE_GULLY_RPC: '', VITE_ROBOTS: 'index, follow' };
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'production', '--ssr', 'src/entry-server.tsx', '--outDir', '.ssr'], { stdio: 'inherit', env: { ...buildEnv, VITE_OUT_DIR: '.ssr' } });
execFileSync(process.execPath, ['scripts/prerender.mjs', out], { stdio: 'inherit', env: buildEnv });
execFileSync(process.execPath, ['load/build-sw.mjs', out, '--prefix', 'gully-bridge', '--never', '/rpc,/rpc-arb,/mirrors.json,/api,/stats,/price', '--pages', '/'], { stdio: 'inherit' });
execFileSync(process.execPath, ['load/first-load.mjs', out, '--budget-kb', '100'], { stdio: 'inherit' });
console.log(`staged (${mainnet ? 'mainnet' : 'testnet'}): ${out}`);
