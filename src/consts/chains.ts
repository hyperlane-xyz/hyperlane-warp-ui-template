import {
  arbitrum,
  arbitrumAddresses,
  ethereum,
  ethereumAddresses,
  treasure,
  treasureAddresses,
} from '@hyperlane-xyz/registry';
import { ChainMap, ChainMetadata } from '@hyperlane-xyz/sdk';

// A map of chain names to ChainMetadata
// Chains can be defined here, in chains.json, or in chains.yaml
// Chains already in the SDK need not be included here unless you want to override some fields
// Schema here: https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/sdk/src/metadata/chainMetadataTypes.ts
export const chains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
  treasure: {
    ...treasure,
    mailbox: treasureAddresses.mailbox,
  },
  arbitrum: {
    ...arbitrum,
    mailbox: arbitrumAddresses.mailbox,
  },
  ethereum: {
    ...ethereum,
    mailbox: ethereumAddresses.mailbox,
  },
  // treasuretopaz: {
  //   ...treasuretopaz,
  //   mailbox: treasuretopazAddresses.mailbox,
  // },
  // arbitrumsepolia: {
  //   ...arbitrumsepolia,
  //   mailbox: arbitrumsepoliaAddresses.mailbox,
  // },
  // sepolia: {
  //   ...sepolia,
  //   mailbox: sepoliaAddresses.mailbox,
  // },
};
