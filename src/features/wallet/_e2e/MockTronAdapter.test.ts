import { AdapterState } from '@tronweb3/tronwallet-abstract-adapter';
import { describe, expect, test } from 'vitest';

import { MOCK_TRON_ADDRESS, MockTronAdapter } from './MockTronAdapter';

// Adapter-smoke coverage for the Tron mock. UI-level autoconnect is not
// wired in this push — matrix entry is labeled "adapter smoke" accordingly.
describe('MockTronAdapter', () => {
  test('connect() sets the fixed address and emits connect', async () => {
    const adapter = new MockTronAdapter();
    expect(adapter.connected).toBe(false);
    expect(adapter.state).toBe(AdapterState.Disconnect);
    const connectPromise = new Promise<string>((resolve) => {
      (adapter as unknown as { on: (event: string, fn: (v: string) => void) => void }).on(
        'connect',
        (addr) => resolve(addr),
      );
    });
    await adapter.connect();
    expect(adapter.connected).toBe(true);
    expect(adapter.address).toBe(MOCK_TRON_ADDRESS);
    expect(await connectPromise).toBe(MOCK_TRON_ADDRESS);
  });
});
