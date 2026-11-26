import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ALLOW: Record<string, string> = {
  '.stack/snapshot.json': 'generated from the gully-ops stack registry (product home URLs), never hand edited',
  'gully/deploy/Caddyfile.bridge': 'CSP connect-src keeps the old name as an alias until the mainnet cut-over',
  'gully/scripts/build-staging.mjs': 'the MAINNET build profile (bridge.gullychain.xyz is the mainnet site)',
  'gully/scripts/deploy-l3.sh': 'post-deploy check of both names the edge serves while the alias exists',
  'gully/src/config/network.test.ts': 'asserts the testnet never lists the old name, and the mainnet hosts',
  'gully/src/config/rpc.test.ts': 'asserts the testnet never lists the old name',
  'gully/src/config/rpc.ts': 'GULLY_MAINNET_PUBLIC_RPCS (48559)',
  'gully/src/gc-switcher/gc-switcher.js': 'vendored byte-identical from gully-ops sites/_shared (comment only)',
  'gully/vite.config.ts': 'mainnet site URL when VITE_NETWORK=mainnet',
  'gully/src/config/testnetHosts.test.ts': 'this guard',
};
// Testnet callers use testnet-rpc.gullychain.xyz / testnet-bridge.gullychain.xyz. At the Gully Chain mainnet
// cut-over rpc.gullychain.xyz and bridge.gullychain.xyz start serving mainnet 48559 (gully-ops l3/mainnet/INFRA.md
// section 6), so a testnet default left on the old names would silently talk to the wrong chain.
// Every file that still names an old host must be in ALLOW with a reason.
const OLD_HOSTS = /\/\/(rpc|bridge)\.gullychain\.xyz/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '.turbo']);

function trackedFiles(root: string): string[] {
  try {
    return execSync('git ls-files', { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean)
  } catch {
    const out: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
        if (SKIP_DIRS.has(e.name)) continue
        const p = dir ? `${dir}/${e.name}` : e.name
        if (e.isDirectory()) walk(p)
        else out.push(p)
      }
    }
    walk('')
    return out
  }
}

function offenders(root: string): string[] {
  const bad: string[] = []
  for (const f of trackedFiles(root)) {
    if (f.endsWith('.md') || ALLOW[f] || !/\.(c|m)?[jt]sx?$|\.(json|ya?ml|sh|py|sol|html|caddy|env|example|toml)$|Caddyfile/.test(f)) continue
    let text: string
    try { text = readFileSync(join(root, f), 'utf8') } catch { continue }
    if (OLD_HOSTS.test(text)) bad.push(f)
  }
  return bad
}

describe('testnet callers use the testnet-* hosts', () => {
  it('no file outside the allowlist names rpc.gullychain.xyz or bridge.gullychain.xyz', () => {
    expect(offenders(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..'))).toEqual([]);
  }, 60_000);
});
