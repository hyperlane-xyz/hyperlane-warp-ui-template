import { describe, expect, it, vi } from 'vitest';

import { safeProps, track } from './umami';

describe('umami analytics helper', () => {
  it('drops addresses, emails and long strings', () => {
    expect(safeProps({ lane: 'fast', who: '0x' + '1'.repeat(40), mail: 'a@b.co', long: 'x'.repeat(65) })).toEqual({ lane: 'fast' });
    expect(safeProps({ who: '0x' + '1'.repeat(40) })).toBeUndefined();
  });
  it('is a no-op without Umami, never throws, and calls umami.track when present', () => {
    expect(() => track('x')).not.toThrow();
    const spy = vi.fn();
    (globalThis as { umami?: unknown }).umami = { track: spy };
    track('bridge', { lane: 'fast' });
    expect(spy).toHaveBeenCalledWith('bridge', { lane: 'fast' });
    (globalThis as { umami?: unknown }).umami = { track: () => { throw new Error('blocked'); } };
    expect(() => track('bridge')).not.toThrow();
    delete (globalThis as { umami?: unknown }).umami;
  });
});
