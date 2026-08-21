import { MockConnector, type MockConnectorAccounts } from '@starknet-react/core';

// Fixed address for deterministic E2E tests. Not a real account on any
// network; the mock connector never broadcasts.
export const MOCK_STARKNET_ADDRESS =
  '0x07e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2';

// Minimal duck-typed AccountInterface. We cast through `unknown` because the
// starknet `AccountInterface` has ~50 methods, none of which the autoconnect
// code path actually calls. Tests that exercise signing would need to flesh
// this out.
function buildFakeAccount() {
  return {
    address: MOCK_STARKNET_ADDRESS,
    cairoVersion: '1',
    transactionVersion: '0x3',
    deploySelf: async () => ({ transaction_hash: '0x0', contract_address: MOCK_STARKNET_ADDRESS }),
    estimateAccountDeployFee: async () => ({
      suggestedMaxFee: 0n,
      resourceBounds: {},
      gas_consumed: 0n,
      gas_price: 0n,
      overall_fee: 0n,
      unit: 'WEI',
    }),
    execute: async () => ({ transaction_hash: '0x0' }),
    signMessage: async () => ['0x0', '0x0'],
  };
}

export function createMockStarknetConnector(): MockConnector {
  // MockConnectorAccounts expects a starknet.js AccountInterface[]. We only
  // care about the `address` accessor for autoconnect, so cast through unknown
  // to sidestep the full 50-method interface.
  const account = buildFakeAccount() as unknown as MockConnectorAccounts['mainnet'][number];
  return new MockConnector({
    accounts: { mainnet: [account], sepolia: [account] },
    options: {
      id: 'warp-e2e-mock-starknet',
      name: 'Warp E2E Mock (Starknet)',
      available: true,
    },
  });
}
