import { describe, expect, it } from 'vitest';

import { GULLY_PUBLIC_RPCS, GULLY_WALLET_RPCS, gullyPriceUrl, gullyRpcList, isGullyHost } from './rpc';

const bridge = { origin: 'https://testnet-bridge.gullychain.xyz', hostname: 'testnet-bridge.gullychain.xyz' };

describe('GullyChain RPC fallback list', () => {
  it('puts same-origin /rpc first on a gullychain.xyz host, then the public list in contract order', () => {
    expect(gullyRpcList(undefined, bridge)).toEqual([
      'https://testnet-bridge.gullychain.xyz/rpc',
      'https://testnet-rpc.gullychain.xyz',
      'https://rpc.gullyrpc.xyz/gullychain/evm/485590',
      'https://rpc2.gullychain.xyz',
    ]);
  });

  it('skips same-origin /rpc off gullychain.xyz and outside the browser', () => {
    expect(gullyRpcList('', { origin: 'https://evil.example', hostname: 'evil.example' })).toEqual([...GULLY_PUBLIC_RPCS]);
    expect(gullyRpcList(undefined, undefined)).toEqual([...GULLY_PUBLIC_RPCS]);
    expect(isGullyHost('gullychain.xyz')).toBe(true);
    expect(isGullyHost('notgullychain.xyz')).toBe(false);
  });

  it('keeps env entries (comma-separated, dev proxy paths made absolute) first, without duplicates', () => {
    const loc = { origin: 'http://127.0.0.1:5173', hostname: '127.0.0.1' };
    expect(gullyRpcList('/rpc/gully, https://testnet-rpc.gullychain.xyz', loc)).toEqual([
      'http://127.0.0.1:5173/rpc/gully',
      'https://testnet-rpc.gullychain.xyz',
      'https://rpc.gullyrpc.xyz/gullychain/evm/485590',
      'https://rpc2.gullychain.xyz',
    ]);
  });

  it('hands wallets the canonical URL first and no pending-DNS host', () => {
    expect(GULLY_WALLET_RPCS[0]).toBe('https://testnet-rpc.gullychain.xyz');
    expect([...GULLY_WALLET_RPCS]).toEqual([...GULLY_PUBLIC_RPCS]);
  });

  it('never lists the mainnet RPC (rpc.gullychain.xyz) for testnet', () => {
    for (const u of [...GULLY_PUBLIC_RPCS, ...GULLY_WALLET_RPCS, ...gullyRpcList(undefined, undefined)]) {
      expect(new URL(u).hostname).not.toBe('rpc.gullychain.xyz');
    }
  });

  it('reads ETH/USD same-origin on a gullychain host, else from gullychain.xyz', () => {
    expect(gullyPriceUrl(bridge)).toBe('https://testnet-bridge.gullychain.xyz/price/eth');
    expect(gullyPriceUrl({ origin: 'http://localhost:5173', hostname: 'localhost' })).toBe('https://gullychain.xyz/price/eth');
    expect(gullyPriceUrl(undefined)).toBe('https://gullychain.xyz/price/eth');
  });
});
