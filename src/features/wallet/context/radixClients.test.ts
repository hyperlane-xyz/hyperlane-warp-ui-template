import { describe, expect, test, vi } from 'vitest';

const { gatewayApi, initializeGatewayApi, radixDappToolkit, rdt } = vi.hoisted(() => {
  const gatewayApi = {};
  const rdt = {
    gatewayApi: { clientConfig: {} },
  };

  return {
    gatewayApi,
    initializeGatewayApi: vi.fn(() => gatewayApi),
    radixDappToolkit: vi.fn(() => rdt),
    rdt,
  };
});

vi.mock('@radixdlt/babylon-gateway-api-sdk', () => ({
  GatewayApiClient: { initialize: initializeGatewayApi },
}));

vi.mock('@radixdlt/radix-dapp-toolkit', () => ({
  RadixDappToolkit: radixDappToolkit,
  RadixNetwork: { Mainnet: 1 },
}));

import { getRadixClients } from './radixClients';

describe('getRadixClients', () => {
  test('retains one live toolkit across Strict Mode-style repeated acquisition', () => {
    const first = getRadixClients();
    const second = getRadixClients();

    expect(second).toBe(first);
    expect(first).toEqual({ gatewayApi, rdt });
    expect(radixDappToolkit).toHaveBeenCalledOnce();
    expect(initializeGatewayApi).toHaveBeenCalledOnce();
  });
});
