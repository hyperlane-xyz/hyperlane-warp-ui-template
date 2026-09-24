// Deterministic addresses the MockCosmosWallet mnemonic resolves to under
// various bech32 prefixes. Any change to the mnemonic or derivation path in
// MockCosmosWallet.ts must regenerate these — the unit tests pin the values.
export const MOCK_COSMOS_MNEMONIC_ADDRESSES = {
  cosmos: 'cosmos19rl4cm2hmr8afy4kldpxz3fka4jguq0auqdal4',
  neutron: 'neutron19rl4cm2hmr8afy4kldpxz3fka4jguq0aclyl9j',
} as const;
