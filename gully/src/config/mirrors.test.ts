import { getAddress } from 'viem';
import { afterEach, describe, expect, it } from 'vitest';

import { checkRecipient, fetchMirrorRoutes, isMirrorRouteId, mirrorRouteId, mirrorRoutes, parseMirrorLink, pickMirrorRoute } from './mirrors';
import { DEFAULT_FAST_ROUTE_ID, FAST_ROUTES, fastRoute, MIRROR_ROUTES, routeFor, setMirrorRoutes } from './routes';

const TOKEN = '0x9665e20624f3a896067d75e51645e7e73fc35c48'; // gTFROG test coin
const COLL = '0x3333333333333333333333333333333333333333';
const MIRROR = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed';

const pair = (o: Record<string, unknown> = {}) => ({
  token: TOKEN,
  name: 'Frog',
  symbol: 'TFROG',
  decimals: 18,
  mirrorName: 'Frog (Gully Chain Testnet)',
  mirrorSymbol: 'gTFROG',
  destination: 'arbitrumsepolia',
  chainName: 'arbitrumsepolia',
  chainId: 421614,
  destinationDomain: 421614,
  collateral: COLL,
  mirror: MIRROR,
  status: 'active',
  relayed: true,
  kre8: `https://kre8.fun/drop/${TOKEN}`,
  ...o,
});
const doc = (pairs: unknown[], extra: Record<string, unknown> = {}) => ({
  schema: 'gully-warp-mirrors/1',
  origin: { chainId: 485590, domain: 485590, name: 'Gully Chain Testnet' },
  pairs,
  ...extra,
});

afterEach(() => setMirrorRoutes([]));

describe('mirror routes from /mirrors.json', () => {
  it('maps an active pair to a FastRoute: collateral on GullyChain, synthetic mirror on the destination', () => {
    const [r] = mirrorRoutes(doc([pair()]));
    expect(r.id).toBe(`MIRROR/${TOKEN}/arbitrumsepolia`);
    expect(r.id).toBe(mirrorRouteId(TOKEN, 'arbitrumsepolia'));
    expect(isMirrorRouteId(r.id)).toBe(true);
    expect(r.symbol).toBe('TFROG');
    expect(r.tokens.gullychaintestnet).toMatchObject({
      address: '0x3333333333333333333333333333333333333333',
      standard: 'EvmHypCollateral',
      tokenType: 'collateral',
      collateralAddress: getAddress(TOKEN),
      symbol: 'TFROG',
      decimals: 18,
    });
    expect(r.tokens.arbitrumsepolia).toMatchObject({
      address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      standard: 'EvmHypSynthetic',
      tokenType: 'synthetic',
      symbol: 'gTFROG',
      name: 'Frog (Gully Chain Testnet)',
      collateralAddress: null,
    });
    expect(r.warp?.label).toBe('Trading on Arbitrum Sepolia · Launched on Gully Chain · Liquidity on Gully Core');
    expect(r.warp?.provenanceUrl).toBe('https://sepolia.arbiscan.io/token/0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
    expect(r.warp?.kre8Url).toBe(`https://kre8.fun/drop/${TOKEN}`);
    expect(r.warp?.syncing).toBe(false);
    expect(r.legacy).toBeUndefined();
  });

  it('skips requested, unrelayed, unknown-chain, non-18-decimal and malformed pairs; dedupes', () => {
    const routes = mirrorRoutes(
      doc([
        pair(),
        pair(),
        pair({ status: 'requested', token: '0xb114fb2bc28beb120b8934f467859cb788e93a0c' }),
        pair({ relayed: false, token: '0x3de9cbf8e013897c4cac6c0dc523abf965372358' }),
        pair({ destination: 'base', chainName: 'base', chainId: 8453, destinationDomain: 8453 }),
        pair({ decimals: 6, token: '0x1111111111111111111111111111111111111111' }),
        pair({ mirror: 'not-an-address', token: '0x2222222222222222222222222222222222222222' }),
      ]),
    );
    expect(routes.map((r) => r.id)).toEqual([`MIRROR/${TOKEN}/arbitrumsepolia`]);
  });

  it('rejects other documents and marks routes syncing while the relayer restarts', () => {
    expect(mirrorRoutes(null)).toEqual([]);
    expect(mirrorRoutes({ schema: 'other', pairs: [pair()] })).toEqual([]);
    expect(mirrorRoutes(doc([pair()], { pendingRelayerRestart: true }))[0].warp?.syncing).toBe(true);
    // kre8 link only to kre8.fun
    expect(mirrorRoutes(doc([pair({ kre8: 'https://evil.example/x' })]))[0].warp?.kre8Url).toBe(`https://kre8.fun/drop/${TOKEN}`);
  });

  it('registry: the default ETH route is unchanged; mirror routes resolve by id and go both ways', () => {
    const before = FAST_ROUTES.map((r) => r.id);
    setMirrorRoutes(mirrorRoutes(doc([pair()])));
    expect(FAST_ROUTES.map((r) => r.id)).toEqual(before);
    expect(MIRROR_ROUTES).toHaveLength(1);
    expect(fastRoute().id).toBe(DEFAULT_FAST_ROUTE_ID);
    const id = MIRROR_ROUTES[0].id;
    expect(routeFor('deposit', id).id).toBe(id);
    expect(routeFor('withdraw', id).id).toBe(id);
    setMirrorRoutes([]);
    expect(fastRoute(id).id).toBe(DEFAULT_FAST_ROUTE_ID);
  });

  it('fetchMirrorRoutes: failures mean no mirror routes', async () => {
    const ok = (async () => new Response(JSON.stringify(doc([pair()])), { status: 200 })) as unknown as typeof fetch;
    expect(await fetchMirrorRoutes('/mirrors.json', 1000, ok)).toHaveLength(1);
    const notFound = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch;
    expect(await fetchMirrorRoutes('/mirrors.json', 1000, notFound)).toEqual([]);
    const boom = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await fetchMirrorRoutes('/mirrors.json', 1000, boom)).toEqual([]);
    const bad = (async () => new Response('{not json', { status: 200 })) as unknown as typeof fetch;
    expect(await fetchMirrorRoutes('/mirrors.json', 1000, bad)).toEqual([]);
  });
});

describe('mirror deep link ?token=<originToken>&to=<domain>', () => {
  it('parses token + numeric domain or chain key', () => {
    expect(parseMirrorLink(`?token=${TOKEN}&to=421614`)).toEqual({ token: getAddress(TOKEN), to: 421614 });
    expect(parseMirrorLink(`token=${TOKEN}&to=arbitrumsepolia`)?.to).toBe(421614);
    expect(parseMirrorLink(`?token=${TOKEN}`)).toEqual({ token: getAddress(TOKEN), to: undefined });
  });

  it('ignores missing or malformed links', () => {
    expect(parseMirrorLink('')).toBeUndefined();
    expect(parseMirrorLink('?to=421614')).toBeUndefined();
    expect(parseMirrorLink('?token=0x123&to=421614')).toBeUndefined();
    expect(parseMirrorLink(`?token=${TOKEN}&to=<script>`)).toBeUndefined();
    expect(parseMirrorLink(`?token=${TOKEN}&to=99999999999`)).toBeUndefined();
  });

  it('selects the matching route, by coin and domain', () => {
    const routes = mirrorRoutes(doc([pair()]));
    expect(pickMirrorRoute(routes, parseMirrorLink(`?token=${TOKEN.toUpperCase().replace('0X', '0x')}&to=421614`))?.id).toBe(routes[0].id);
    expect(pickMirrorRoute(routes, parseMirrorLink(`?token=${TOKEN}`))?.id).toBe(routes[0].id);
    expect(pickMirrorRoute(routes, parseMirrorLink(`?token=${TOKEN}&to=8453`))).toBeUndefined();
    expect(pickMirrorRoute(routes, undefined)).toBeUndefined();
  });
});

describe('warp transfer recipient', () => {
  it('refuses the zero address and non-addresses, accepts a real address', () => {
    expect(() => checkRecipient('0x0000000000000000000000000000000000000000')).toThrow(/zero address/);
    expect(() => checkRecipient(undefined)).toThrow(/valid recipient/);
    expect(() => checkRecipient('0x1234')).toThrow(/valid recipient/);
    expect(checkRecipient('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')).toBe('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
  });
});
