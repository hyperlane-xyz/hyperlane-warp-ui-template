// Fixed accounts the E2E mocks connect as.
//
// EVM: chosen so it stands out in traces (0xE2eE… pattern).
// Solana: derived from `Keypair.fromSeed(new Uint8Array(32).fill(0xe2))`.
// Cosmos: derived from DirectSecp256k1HdWallet.fromMnemonic(<BIP39 test vector>,
//   { prefix: 'cosmos' }). Pinned in MockCosmosWallet.test.fixtures.ts; keep
//   all three in sync with each other.
export const MOCK_EVM_ADDRESS = '0xE2eE2eE2eE2eE2eE2eE2eE2eE2eE2eE2eE2eE2eE' as const;
export const MOCK_SOLANA_ADDRESS = 'EY4LF4gq73QHyff6McmgPKU6UuPtErVU7vVAYcv2nwGi' as const;
export const MOCK_COSMOS_ADDRESS = 'cosmos19rl4cm2hmr8afy4kldpxz3fka4jguq0auqdal4' as const;

export const MOCK_EVM_CONNECTOR_ID = 'mock';
