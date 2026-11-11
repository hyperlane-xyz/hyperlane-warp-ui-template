// Network switch (VITE_NETWORK): testnet stays the default and unchanged; mainnet = Gully Chain 48559 on Arbitrum One
// with every not-yet-deployed address unset, so no lane is offered until launch day.
import { afterEach, describe, expect, it, vi } from 'vitest';

import mainnetJson from './mainnet.json';
import { NO_CAPS, addr, canonicalReady, fastReady, mainnetConfig, parseNetwork } from './network';

const SLOW = 120_000;
const A = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const chains = await import('./chains');
  const routes = await import('./routes');
  const network = await import('./network');
  return { ...chains, ...routes, ...network };
}

describe('parseNetwork', () => {
  it('defaults to testnet and refuses anything but testnet or mainnet', () => {
    expect(parseNetwork(undefined)).toBe('testnet');
    expect(parseNetwork('')).toBe('testnet');
    expect(parseNetwork('Testnet')).toBe('testnet');
    expect(parseNetwork(' mainnet ')).toBe('mainnet');
    expect(() => parseNetwork('main')).toThrow(/testnet or mainnet/);
  });
});

describe('mainnet config (mainnet.json + VITE_MAINNET_*)', () => {
  it('matches the gully-ops mainnet plan: 48559 on Arbitrum One, 7-day challenge, Phase 1 caps', () => {
    expect(mainnetJson.parent.id).toBe(42161);
    expect(mainnetJson.child.id).toBe(48559);
    const m = mainnetConfig({});
    expect(m.confirmPeriodBlocks).toBe(50400n); // rollup-config.json bold.confirmPeriodBlocks
    expect(Number(m.confirmPeriodBlocks) * mainnetJson.canonical.l1BlockSeconds).toBe(7 * 86400);
    expect(m.caps.fastPerTransfer).toBe(2n * 10n ** 18n);
    expect(m.caps.fastRouteCollateral).toBe(25n * 10n ** 18n);
    expect(m.caps.canonicalSoftCap).toBe(100n * 10n ** 18n);
    expect(m.caps.fastDaily).toBeNull(); // PLAN.md names no number: on-chain rate limit only
    expect(m.parentMailbox).toBe('0x979Ca5202784112f4738403dBec5D0F3B9daabB9');
  });

  it('leaves every launch-day address unset, so neither lane is ready', () => {
    const m = mainnetConfig({});
    for (const k of ['inbox', 'bridge', 'outbox', 'rollup', 'childMailbox', 'fastParentRouter', 'fastChildRouter'] as const)
      expect(m[k], k).toBeNull();
    expect(canonicalReady(m)).toBe(false);
    expect(fastReady(m)).toBe(false);
  });

  it('takes valid env addresses, ignores malformed and zero ones', () => {
    expect(addr('0x0000000000000000000000000000000000000000')).toBeNull();
    expect(addr('0x1234')).toBeNull();
    expect(addr(null)).toBeNull();
    const m = mainnetConfig({
      VITE_MAINNET_INBOX: A(1),
      VITE_MAINNET_BRIDGE: A(2),
      VITE_MAINNET_OUTBOX: A(3),
      VITE_MAINNET_ROLLUP: 'not-an-address',
    });
    expect(m.inbox).toBe(addr(A(1)));
    expect(m.rollup).toBeNull();
    expect(canonicalReady(m)).toBe(false);
    expect(canonicalReady(mainnetConfig({ VITE_MAINNET_INBOX: A(1), VITE_MAINNET_BRIDGE: A(2), VITE_MAINNET_OUTBOX: A(3), VITE_MAINNET_ROLLUP: A(4) }))).toBe(true);
    // the Fast lane also needs the parent block the routers were deployed at (log scans on Arbitrum One)
    const f = { VITE_MAINNET_CHILD_MAILBOX: A(5), VITE_MAINNET_FAST_PARENT_ROUTER: A(6), VITE_MAINNET_FAST_CHILD_ROUTER: A(7) };
    expect(fastReady(mainnetConfig(f))).toBe(false);
    expect(fastReady(mainnetConfig({ ...f, VITE_MAINNET_FAST_FROM_BLOCK: '400000000' }))).toBe(true);
  });
});

describe('testnet build (default): unchanged', () => {
  it('keeps Arbitrum Sepolia + GullyChain Testnet, the testnet RPCs, the faucet and no caps', async () => {
    const t = await load({});
    expect(t.NETWORK).toBe('testnet');
    expect(t.CHAINS.arbitrumsepolia.id).toBe(421614);
    expect(t.CHAINS.gullychaintestnet.id).toBe(485590);
    expect(t.CHAINS.gullychaintestnet.rpcs).not.toContain('https://rpc.gullychain.xyz');
    expect(t.CANONICAL.outbox).toBe('0x976C651fe5E63E45C8C28449507F51548922f68c');
    expect(t.CANONICAL.confirmPeriodBlocks).toBe(150n);
    expect(t.CANONICAL_READY).toBe(true);
    expect(t.LINKS.faucet).toBe('https://faucet.gullychain.xyz');
    expect(t.CAPS).toEqual(NO_CAPS);
    expect(t.FAST_ROUTES.length).toBe(t.ROUTE_TABLE.length);
    expect(t.FAST_ROUTES.length).toBeGreaterThan(0);
  }, SLOW);
});

describe('mainnet build (VITE_NETWORK=mainnet)', () => {
  it('is Gully Chain 48559 on Arbitrum One with mainnet RPCs only, no faucet, no same-origin /rpc', async () => {
    const m = await load({ VITE_NETWORK: 'mainnet' });
    expect(m.IS_TESTNET).toBe(false);
    expect(m.CHAINS.arbitrumsepolia.id).toBe(42161);
    expect(m.CHAINS.arbitrumsepolia.name).toBe('Arbitrum One');
    expect(m.CHAINS.arbitrumsepolia.explorer).toBe('https://arbiscan.io');
    expect(m.CHAINS.gullychaintestnet.id).toBe(48559);
    expect(m.CHAINS.gullychaintestnet.explorer).toBe('https://gullyscan.xyz');
    const rpcs = m.CHAINS.gullychaintestnet.rpcs;
    expect(rpcs).toEqual(['https://rpc.gullychain.xyz', 'https://rpc.gullyrpc.xyz/gullychain/evm/48559']);
    for (const u of [...rpcs, ...m.CHAINS.gullychaintestnet.walletRpcs, ...m.CHAINS.arbitrumsepolia.rpcs])
      expect(u, u).not.toMatch(/testnet|sepolia|485590|rpc2\.|bridge\.gullychain\.xyz\/rpc/);
    expect(m.LINKS.faucet).toBeNull();
    expect(m.LINKS.explorer).toBe('https://gullyscan.xyz');
    // on bridge.gullychain.xyz the same-origin /rpc still proxies to the testnet, so the mainnet list never uses it
    const { gullyRpcList, GULLY_MAINNET_PUBLIC_RPCS } = await import('./rpc');
    const host = { origin: 'https://bridge.gullychain.xyz', hostname: 'bridge.gullychain.xyz' };
    expect(gullyRpcList('', host, GULLY_MAINNET_PUBLIC_RPCS, false)).toEqual([...GULLY_MAINNET_PUBLIC_RPCS]);
    expect(gullyRpcList('', host)[0]).toBe('https://bridge.gullychain.xyz/rpc'); // testnet behaviour unchanged
  }, SLOW);

  it('offers no lane while the mainnet contracts are unset, and applies the Phase 1 caps', async () => {
    const m = await load({ VITE_NETWORK: 'mainnet' });
    expect(m.CANONICAL_READY).toBe(false);
    expect(m.CANONICAL.outbox).toBe('0x0000000000000000000000000000000000000000');
    expect(m.CANONICAL.confirmPeriodBlocks).toBe(50400n);
    expect(m.FAST_ROUTES).toEqual([]);
    expect(m.ROUTE_TABLE).toHaveLength(1);
    expect(m.routeReady(m.fastRoute())).toBe(false);
    expect(m.CAPS.fastPerTransfer).toBe(2n * 10n ** 18n);
    expect(m.CAPS.fastRouteCollateral).toBe(25n * 10n ** 18n);
    expect(m.CAPS.canonicalSoftCap).toBe(100n * 10n ** 18n);
  }, SLOW);

  it('opens the lanes once the launch-day addresses are configured', async () => {
    const m = await load({
      VITE_NETWORK: 'mainnet',
      VITE_MAINNET_INBOX: A(1),
      VITE_MAINNET_BRIDGE: A(2),
      VITE_MAINNET_OUTBOX: A(3),
      VITE_MAINNET_ROLLUP: A(4),
      VITE_MAINNET_CHILD_MAILBOX: A(5),
      VITE_MAINNET_FAST_PARENT_ROUTER: A(6),
      VITE_MAINNET_FAST_CHILD_ROUTER: A(7),
      VITE_MAINNET_FAST_FROM_BLOCK: '400000000',
    });
    expect(m.CANONICAL_READY).toBe(true);
    expect(m.CANONICAL.inbox).toBe(addr(A(1)));
    expect(m.FAST_ROUTES).toHaveLength(1);
    expect(m.FAST_ROUTES[0]!.tokens.arbitrumsepolia.address).toBe(addr(A(6)));
    expect(m.CHAINS.gullychaintestnet.mailbox).toBe(addr(A(5)));
    expect(m.CHAINS.arbitrumsepolia.fastFromBlock).toBe(400000000n);
  }, SLOW);
});
