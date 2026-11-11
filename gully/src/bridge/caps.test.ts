// Phase 1 caps (gully-ops l3/mainnet/PLAN.md): the pure check, and the quote gate that the button and pickRoute use.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NO_CAPS, mainnetConfig } from '../config/network';
import { readFileSync } from 'node:fs';

import { sendBlocker } from './blocker';
import { capLines, checkCaps, needsParentLocked } from './caps';

const ETH = 10n ** 18n;
const CAPS = mainnetConfig({}).caps;
const SLOW = 120_000;

describe('checkCaps (mainnet Phase 1 caps)', () => {
  it('refuses a Fast transfer over 2 ETH, both ways', () => {
    for (const direction of ['deposit', 'withdraw'] as const) {
      const r = checkCaps(CAPS, { kind: 'fast', direction, amount: 2n * ETH + 1n, parentLocked: 0n });
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/2 ETH per transfer/);
      expect(checkCaps(CAPS, { kind: 'fast', direction, amount: 2n * ETH, parentLocked: 0n }).ok).toBe(true);
    }
  });

  it('refuses a Fast deposit that would take the Arbitrum router over 25 ETH, and fails closed when unread', () => {
    expect(checkCaps(CAPS, { kind: 'fast', direction: 'deposit', amount: ETH, parentLocked: 24n * ETH }).ok).toBe(true);
    const over = checkCaps(CAPS, { kind: 'fast', direction: 'deposit', amount: ETH + 1n, parentLocked: 24n * ETH });
    expect(over.ok).toBe(false);
    expect(over.reason).toMatch(/25 ETH cap/);
    expect(checkCaps(CAPS, { kind: 'fast', direction: 'deposit', amount: ETH }).ok).toBe(false);
    // withdrawals lower the collateral, so only the per-transfer cap applies
    expect(checkCaps(CAPS, { kind: 'fast', direction: 'withdraw', amount: ETH, parentLocked: 30n * ETH }).ok).toBe(true);
    expect(needsParentLocked(CAPS, 'fast', 'withdraw')).toBe(false);
  });

  it('refuses a canonical deposit that would take the Nitro bridge over 100 ETH; withdrawals always pass', () => {
    expect(checkCaps(CAPS, { kind: 'canonical', direction: 'deposit', amount: 5n * ETH, parentLocked: 95n * ETH }).ok).toBe(true);
    const r = checkCaps(CAPS, { kind: 'canonical', direction: 'deposit', amount: 5n * ETH + 1n, parentLocked: 95n * ETH });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/100 ETH Phase 1 cap/);
    expect(checkCaps(CAPS, { kind: 'canonical', direction: 'deposit', amount: ETH }).ok).toBe(false);
    expect(checkCaps(CAPS, { kind: 'canonical', direction: 'withdraw', amount: 500n * ETH }).ok).toBe(true);
  });

  it('shows the limits to users on mainnet and nothing on testnet', () => {
    expect(capLines(CAPS)).toEqual([
      'Fast lane: up to 2 ETH per transfer',
      'Fast lane: 25 ETH in total',
      'Canonical bridge: 100 ETH in total',
    ]);
    expect(capLines(NO_CAPS)).toEqual([]);
    expect(checkCaps(NO_CAPS, { kind: 'fast', direction: 'deposit', amount: 1000n * ETH }).ok).toBe(true);
  });
});

// ---- the quote gate in localClient (mainnet build, chains mocked)
const A = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as `0x${string}`;
const READY = {
  VITE_NETWORK: 'mainnet',
  VITE_MAINNET_INBOX: A(1),
  VITE_MAINNET_BRIDGE: A(2),
  VITE_MAINNET_OUTBOX: A(3),
  VITE_MAINNET_ROLLUP: A(4),
  VITE_MAINNET_CHILD_MAILBOX: A(5),
  VITE_MAINNET_FAST_PARENT_ROUTER: A(6),
  VITE_MAINNET_FAST_CHILD_ROUTER: A(7),
  VITE_MAINNET_FAST_FROM_BLOCK: '400000000',
};
const balances: Record<string, bigint> = {};
let failReads = false;
let walletOpened = 0;

async function client(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  vi.doMock('./clients', () => ({
    pub: () => ({
      getBalance: async ({ address }: { address: string }) => {
        if (failReads) throw new Error('rpc down');
        return balances[address.toLowerCase()] ?? 0n;
      },
      readContract: async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
        if (functionName === 'quoteTransferRemote') return [{ token: A(0), amount: 1000n }, { token: A(0), amount: args![2] as bigint }];
        if (functionName === 'confirmPeriodBlocks') return 50400n;
        throw new Error(`unexpected ${functionName}`);
      },
    }),
  }));
  vi.doMock('./wallet', async (orig) => ({
    ...(await orig<object>()),
    ensureChain: async () => {
      walletOpened++;
    },
  }));
  const { localBridgeClient } = await import('./localClient');
  return localBridgeClient;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('./clients');
  vi.doUnmock('./wallet');
  failReads = false;
  walletOpened = 0;
  vi.resetModules();
  for (const k of Object.keys(balances)) delete balances[k];
});

describe('the mainnet caps themselves', () => {
  it('mainnet.json holds the 25 ETH route and 2 ETH per-transfer caps', () => {
    expect(CAPS.fastPerTransfer).toBe(2n * ETH);
    expect(CAPS.fastRouteCollateral).toBe(25n * ETH);
    expect(CAPS.canonicalSoftCap).toBe(100n * ETH);
  });
});

describe('the UI refuses (button text + disabled)', () => {
  const quote = (over: object) => ({ available: true, value: 0n, sendSymbol: 'ETH', ...over }) as never;
  const base = { amount: ETH, quoting: false, wallet: A(9), balanceFrom: 100n * ETH, paysValueFromBalance: true };

  it('an over-cap or unpayable quote blocks Send and shows the reason, whatever the wallet holds', () => {
    const r = 'Fast lane limit: 2 ETH per transfer during Phase 1';
    expect(sendBlocker({ ...base, quote: quote({ available: false, reason: r }) })).toBe(r);
    expect(sendBlocker({ ...base, quote: quote({ available: false }) })).toBe('Route unavailable');
    expect(sendBlocker({ ...base, quote: quote({}) })).toBeUndefined();
    expect(sendBlocker({ ...base, quote: undefined })).toBe('No quote');
    expect(sendBlocker({ ...base, quote: undefined, quoting: true })).toBe('Getting a quote');
  });

  it('the Send button is wired to the blocker', () => {
    expect(readFileSync('src/ui/common/parts.tsx', 'utf8')).toContain('disabled={!!b.blocker || b.busy}');
  });
});

describe('quotes only what the destination router can pay (mainnet build)', () => {
  it('deposit: the Gully Chain router must hold the amount', async () => {
    const c = await client(READY);
    balances[A(6).toLowerCase()] = 0n;
    balances[A(7).toLowerCase()] = ETH;
    expect((await c.quote({ kind: 'fast', direction: 'deposit', amount: ETH })).available).toBe(true);
    const q = await c.quote({ kind: 'fast', direction: 'deposit', amount: ETH + 1n });
    expect(q.available).toBe(false);
    expect(q.reason).toMatch(/Fast lane liquidity on Gully Chain is 1 ETH/);
  }, SLOW);

  it('withdraw: the Arbitrum One router must hold the amount', async () => {
    const c = await client(READY);
    balances[A(6).toLowerCase()] = ETH / 2n;
    const q = await c.quote({ kind: 'fast', direction: 'withdraw', amount: ETH });
    expect(q.available).toBe(false);
    expect(q.reason).toMatch(/Fast lane liquidity on Arbitrum/);
  }, SLOW);

  it('never offers a quote when the destination cannot be read', async () => {
    const c = await client(READY);
    balances[A(6).toLowerCase()] = 0n;
    failReads = true;
    await expect(c.quote({ kind: 'fast', direction: 'withdraw', amount: ETH }).then((q) => q.available, () => false)).resolves.toBe(false);
  }, SLOW);

  it('execute reads caps and liquidity again: a stale quote never reaches the wallet', async () => {
    const c = await client(READY);
    balances[A(6).toLowerCase()] = 0n;
    balances[A(7).toLowerCase()] = 10n * ETH;
    const q = await c.quote({ kind: 'fast', direction: 'deposit', amount: ETH });
    expect(q.available).toBe(true);
    await expect(c.execute({ ...q, req: { ...q.req, amount: 3n * ETH } }, () => undefined)).rejects.toThrow(/2 ETH per transfer/);
    balances[A(6).toLowerCase()] = 25n * ETH;
    await expect(c.execute(q, () => undefined)).rejects.toThrow(/Fast lane is full/);
    expect(walletOpened).toBe(0);
  }, SLOW);
});

describe('quote gate (mainnet build)', () => {
  it('offers neither lane before the launch-day addresses exist', async () => {
    const c = await client({ VITE_NETWORK: 'mainnet' });
    const f = await c.quote({ kind: 'fast', direction: 'deposit', amount: ETH });
    const k = await c.quote({ kind: 'canonical', direction: 'deposit', amount: ETH });
    expect([f.available, f.reason]).toEqual([false, 'Fast lane opens on launch day']);
    expect([k.available, k.reason]).toEqual([false, 'Canonical bridge opens on launch day']);
  }, SLOW);

  it('applies the caps to real quotes once configured (7-day canonical withdrawal)', async () => {
    const c = await client(READY);
    balances[A(6).toLowerCase()] = 24n * ETH; // Arbitrum One router (Fast lane collateral)
    balances[A(7).toLowerCase()] = 10n * ETH; // Gully Chain router liquidity
    balances[A(2).toLowerCase()] = 99n * ETH; // Nitro bridge
    const ok = await c.quote({ kind: 'fast', direction: 'deposit', amount: ETH / 2n });
    expect(ok.available).toBe(true);
    const big = await c.quote({ kind: 'fast', direction: 'deposit', amount: 3n * ETH });
    expect([big.available, big.reason]).toEqual([false, 'Fast lane limit: 2 ETH per transfer during Phase 1']);
    const full = await c.quote({ kind: 'fast', direction: 'deposit', amount: 2n * ETH });
    expect(full.available).toBe(false);
    expect(full.reason).toMatch(/Fast lane is full: 25 ETH cap/);
    const canon = await c.quote({ kind: 'canonical', direction: 'deposit', amount: 2n * ETH });
    expect(canon.available).toBe(false);
    expect(canon.reason).toMatch(/100 ETH Phase 1 cap/);
    const out = await c.quote({ kind: 'canonical', direction: 'withdraw', amount: 2n * ETH });
    expect(out.available).toBe(true);
    expect(out.etaSeconds).toBe(7 * 86400 + 15 * 60);
    expect(out.notes.join(' ')).toMatch(/claim on Arbitrum One/);
  }, SLOW);
});
