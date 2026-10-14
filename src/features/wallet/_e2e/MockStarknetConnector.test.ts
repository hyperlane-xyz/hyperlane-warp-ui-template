import { describe, expect, test } from 'vitest';

import { MOCK_STARKNET_ADDRESS, createMockStarknetConnector } from './MockStarknetConnector';

// Adapter-smoke coverage for the Starknet mock. The UI-level autoconnect path
// is covered by tests/e2e-wallet/autoconnect/starknet.spec.ts.
describe('MockStarknetConnector', () => {
  test('connect resolves to the fixed mock address on each chain', async () => {
    const connector = createMockStarknetConnector();
    expect(connector.id).toBe('warp-e2e-mock-starknet');
    expect(connector.available()).toBe(true);

    const result = await connector.connect();
    expect(result.account).toBe(MOCK_STARKNET_ADDRESS);
  });
});
