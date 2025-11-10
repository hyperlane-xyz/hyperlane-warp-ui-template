import { describe, expect, it } from 'vitest';
import { links } from '../../consts/links';

describe('links const', () => {
  it('exports an object', () => {
    expect(typeof links).toBe('object');
    expect(links).not.toBeNull();
  });

  it('contains the expected keys', () => {
    const expectedKeys = [
      'pruv',
      'd3labs',
      'home',
      'explorer',
      'discord',
      'github',
      'docs',
      'warpDocs',
      'gasDocs',
      'chains',
      'twitter',
      'blog',
      'tos',
      'privacyPolicy',
      'bounty',
      'imgPath',
    ];
    const actualKeys = Object.keys(links).sort();
    expect(actualKeys).toEqual(expectedKeys.sort());
  });

  it('all values are non-empty strings and look like URLs', () => {
    const values = Object.values(links);
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
      // basic URL sanity check: starts with http:// or https://
      expect(/^https?:\/\//.test(v)).toBe(true);
    }
  });

  it('values are unique (no duplicates)', () => {
    const values = Object.values(links);
    const uniq = new Set(values);
    expect(uniq.size).toBe(values.length);
  });

  it('specific known entries are correct or include expected substrings', () => {
    expect(links.pruv).toBe('https://pruv.finance');
    expect(links.d3labs).toBe('https://d3labs.io');
    expect(links.home).toContain('hyperlane.xyz');
    expect(links.github).toContain('github.com');
    expect(links.bounty).toContain('github.com/search');
    expect(links.imgPath).toContain('cdn.jsdelivr.net');
  });
});
