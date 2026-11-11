// npm run routes: old classic configs and new multi-chain configs (EVM + Sealevel), against a throwaway registry.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../scripts/sync-routes.mjs', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'gully-routes-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const evm = (chainName, addressOrDenom, standard, tokenType, symbol, decimals, extra = {}) => ({ chainName, addressOrDenom, standard, tokenType, symbol, name: symbol, decimals, ...extra });
const yaml = (o) => JSON.stringify(o, null, 2); // JSON is valid YAML

function registry({ solDeployed }) {
  const dir = join(root, solDeployed ? 'a' : 'b');
  const reg = join(dir, 'registry');
  mkdirSync(join(reg, 'deployments/warp_routes/ETH'), { recursive: true });
  mkdirSync(join(reg, 'deployments/warp_routes/SOL'), { recursive: true });
  mkdirSync(join(dir, 'multichain'), { recursive: true });
  writeFileSync(
    join(reg, 'deployments/warp_routes/ETH/arbitrumsepolia-gullychaintestnet-native-config.yaml'),
    yaml({ tokens: [evm('gullychaintestnet', '0xB1', 'EvmHypNative', 'native', 'ETH', 18), evm('arbitrumsepolia', '0x9E', 'EvmHypNative', 'native', 'ETH', 18)] }),
  );
  writeFileSync(
    join(reg, 'deployments/warp_routes/ETH/arbitrumsepolia-gullychaintestnet-config.yaml'),
    yaml({ tokens: [evm('gullychaintestnet', '0xC9', 'EvmHypSynthetic', 'synthetic', 'hypETH', 18), evm('arbitrumsepolia', '0x60', 'EvmHypNative', 'native', 'ETH', 18)] }),
  );
  if (solDeployed)
    writeFileSync(
      join(reg, 'deployments/warp_routes/SOL/gullychaintestnet-solanadevnet-config.yaml'),
      yaml({
        tokens: [
          evm('gullychaintestnet', '0x5011', 'EvmHypSynthetic', 'synthetic', 'SOL', 9),
          evm('solanadevnet', 'GPCsiXvm9NaFjrxB6sThscap6akyvRgD5V6decCk25c', 'SealevelHypNative', 'native', 'SOL', 9),
        ],
      }),
    );
  writeFileSync(
    join(dir, 'multichain/routes.yaml'),
    yaml({
      networks: {
        testnet: {
          gully: 'gullychaintestnet',
          chains: {
            gullychaintestnet: { protocol: 'ethereum', domain: 485590, name: 'Gully', logo: 'gullychain', explorer: 'x', nativeSymbol: 'ETH' },
            arbitrumsepolia: { protocol: 'ethereum', domain: 421614, name: 'Arb', logo: 'arbitrum', explorer: 'x', nativeSymbol: 'ETH', canonical: true },
            solanadevnet: { protocol: 'sealevel', domain: 1399811151, name: 'Solana Devnet', logo: 'solana', explorer: 'x', nativeSymbol: 'SOL' },
          },
          routes: {
            SOL: { id: 'SOL/gullychaintestnet-solanadevnet', symbol: 'SOL', name: 'Solana', decimals: 9, gully: { type: 'synthetic' }, legs: { solanadevnet: { type: 'native' } } },
            'USDC-SOL': {
              id: 'USDC/gullychaintestnet-solanadevnet',
              symbol: 'USDC',
              name: 'USD Coin',
              decimals: 6,
              gully: { type: 'collateral', token: '0x65Ba', decimals: 6 },
              legs: { solanadevnet: { type: 'collateral', token: '4zMM', decimals: 6 } },
            },
          },
        },
      },
    }),
  );
  return reg;
}

function run(reg) {
  const out = join(reg, '..', 'routes.json');
  execFileSync(process.execPath, [script, reg], { env: { ...process.env, GULLY_ROUTES_OUT: out }, stdio: 'pipe' });
  return JSON.parse(readFileSync(out, 'utf8'));
}

describe('npm run routes', () => {
  it('keeps the classic output: native ETH default, older routes legacy', () => {
    const r = run(registry({ solDeployed: false }));
    expect(r.defaultRouteId).toBe('ETH/arbitrumsepolia-gullychaintestnet-native');
    expect(r.routes.map((x) => [x.id, !!x.legacy])).toEqual([
      ['ETH/arbitrumsepolia-gullychaintestnet-native', false],
      ['ETH/arbitrumsepolia-gullychaintestnet', true],
    ]);
  });

  it('writes planned manifest routes with null addresses ("Coming soon")', () => {
    const r = run(registry({ solDeployed: false }));
    const sol = r.multichain.find((x) => x.key === 'SOL');
    expect(sol.deployed).toBe(false);
    expect(sol.tokens.solanadevnet).toMatchObject({ address: null, tokenType: 'native', symbol: 'SOL', decimals: 9 });
    expect(r.multichain.find((x) => x.key === 'USDC-SOL').tokens.solanadevnet.collateralAddress).toBe('4zMM');
    expect(r.chains.solanadevnet.protocol).toBe('sealevel');
  });

  it('picks up a deployed Sealevel route from the Hyperlane CLI config', () => {
    const r = run(registry({ solDeployed: true }));
    const sol = r.multichain.find((x) => x.key === 'SOL');
    expect(sol.deployed).toBe(true);
    expect(sol.tokens.solanadevnet).toMatchObject({ address: 'GPCsiXvm9NaFjrxB6sThscap6akyvRgD5V6decCk25c', standard: 'SealevelHypNative' });
    expect(sol.tokens.gullychaintestnet.address).toBe('0x5011');
    // a deployed manifest route never becomes a classic (legacy) route
    expect(r.routes.some((x) => x.id === 'SOL/gullychaintestnet-solanadevnet')).toBe(false);
  });
});
