import { describe, expect, test } from 'vitest';

import { MOCK_STARKNET_ADDRESS, createMockStarknetConnector } from './MockStarknetConnector';

// Adapter-smoke coverage for the Starknet mock. UI-level autoconnect is wired
// (see E2EAutoConnectStarknet) but not covered by a Playwright spec in this
// push — matrix entry is labeled "adapter smoke" accordingly.
describe('MockStarknetConnector', () => {
  test('connect resolves to the fixed mock address on each chain', async () => {
    const connector = createMockStarknetConnector();
    expect(connector.id).toBe('warp-e2e-mock-starknet');
    expect(connector.available()).toBe(true);

    const result = await connector.connect();
    expect(result.account).toBe(MOCK_STARKNET_ADDRESS);
  });
});
