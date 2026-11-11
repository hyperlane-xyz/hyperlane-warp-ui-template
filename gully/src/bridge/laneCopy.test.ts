import { describe, expect, it } from 'vitest';

import { cheapestUnavailable, inWords, laneCopy } from './laneCopy';

describe('Fast / Cheapest copy', () => {
  it('Fast: time and fee in plain words', () => {
    const c = laneCopy({ kind: 'fast', direction: 'deposit', remoteName: 'Base Sepolia' });
    expect(c.title).toBe('Fast');
    expect(c.line).toMatch(/about 1 to 3 minutes/);
    expect(c.line).toMatch(/network gas/);
    expect(c.line).not.toMatch(/Hyperlane|ISM|relayer/i);
  });

  it('Cheapest deposit: canonical Arbitrum bridge, about a minute, no bridge fee', () => {
    const c = laneCopy({ kind: 'canonical', direction: 'deposit', remoteName: 'Arbitrum Sepolia' });
    expect(c.title).toBe('Cheapest');
    expect(c.line).toMatch(/canonical Arbitrum bridge/);
    expect(c.line).toMatch(/about a minute/);
    expect(c.line).toMatch(/No bridge fee/);
  });

  it('Cheapest withdrawal: the real safety window, then a claim', () => {
    expect(laneCopy({ kind: 'canonical', direction: 'withdraw', remoteName: 'Arbitrum Sepolia', withdrawSeconds: 7 * 86400 }).line).toMatch(
      /about 7 days .* claim on Arbitrum Sepolia/,
    );
    expect(laneCopy({ kind: 'canonical', direction: 'withdraw', remoteName: 'Arbitrum Sepolia', withdrawSeconds: 2700 }).line).toMatch(/about 45 minutes/);
  });

  it('explains when Fast is the only lane', () => {
    expect(cheapestUnavailable('Base Sepolia', 'ETH', false)).toMatch(/Base Sepolia has one lane: Fast/);
    expect(cheapestUnavailable('Arbitrum Sepolia', 'USDC', true)).toMatch(/only moves ETH/);
  });

  it('durations in words', () => {
    expect(inWords(30)).toBe('about a minute');
    expect(inWords(3600 * 5)).toBe('about 5 hours');
    expect(inWords(86400 * 2)).toBe('about 2 days');
  });
});
