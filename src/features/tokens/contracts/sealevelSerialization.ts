import { PublicKey } from '@solana/web3.js';

/**
 * Hyperlane Token Borsh Schema
 */

export class AccountDataWrapper {
  initialized!: boolean;
  data!: HyperlaneTokenData;
  constructor(public readonly fields: any) {
    Object.assign(this, fields);
  }
}

// Should match https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/trevor/sealevel-validator-rebase/rust/sealevel/libraries/hyperlane-sealevel-token/src/accounts.rs#L21
export class HyperlaneTokenData {
  /// The bump seed for this PDA.
  bump!: number;
  /// The address of the mailbox contract.
  mailbox!: Uint8Array;
  mailbox_pubkey!: PublicKey;
  /// The Mailbox process authority specific to this program as the recipient.
  mailbox_process_authority!: Uint8Array;
  mailbox_process_authority_pubkey!: PublicKey;
  /// The dispatch authority PDA's bump seed.
  dispatch_authority_bump!: number;
  /// The decimals of the local token.
  decimals!: number;
  /// The decimals of the remote token.
  remote_decimals!: number;
  /// Access control owner.
  owner?: Uint8Array;
  owner_pub_key?: PublicKey;
  /// The interchain security module.
  interchain_security_module?: Uint8Array;
  interchain_security_module_pubkey?: PublicKey;
  /// Remote routers.
  remote_routers?: Map<DomainId, Uint8Array>;
  remote_router_pubkeys: Map<DomainId, PublicKey>;
  constructor(public readonly fields: any) {
    Object.assign(this, fields);
    this.mailbox_pubkey = new PublicKey(this.mailbox);
    this.mailbox_pubkey = new PublicKey(this.mailbox_process_authority);
    this.owner_pub_key = this.owner ? new PublicKey(this.owner) : undefined;
    this.interchain_security_module_pubkey = this.interchain_security_module
      ? new PublicKey(this.interchain_security_module)
      : undefined;
    this.remote_router_pubkeys = new Map<number, PublicKey>();
    if (this.remote_routers) {
      for (const [k, v] of this.remote_routers.entries()) {
        this.remote_router_pubkeys.set(k, new PublicKey(v));
      }
    }
  }
}

export const HyperlaneTokenDataSchema = new Map<any, any>([
  [
    AccountDataWrapper,
    {
      kind: 'struct',
      fields: [
        ['initialized', 'u8'],
        ['data', HyperlaneTokenData],
      ],
    },
  ],
  [
    HyperlaneTokenData,
    {
      kind: 'struct',
      fields: [
        ['bump', 'u8'],
        ['mailbox', [32]],
        ['mailbox_process_authority', [32]],
        ['dispatch_authority_bump', 'u8'],
        ['decimals', 'u8'],
        ['remote_decimals', 'u8'],
        ['owner', { kind: 'option', type: [32] }],
        ['interchain_security_module', { kind: 'option', type: [32] }],
        ['remote_routers', { kind: 'map', key: 'u32', value: [32] }],
      ],
    },
  ],
]);

/**
 * Transfer Remote Borsh Schema
 */

// Should match Instruction in https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/trevor/sealevel-validator-rebase/rust/sealevel/libraries/hyperlane-sealevel-token/src/instruction.rs
export enum HypTokenInstruction {
  Init,
  TransferRemote,
  EnrollRemoteRouter,
  EnrollRemoteRouters,
  SetInterchainSecurityModule,
  TransferOwnership,
}

export class TransferRemoteWrapper {
  instruction!: number;
  data!: TransferRemoteInstruction;
  constructor(public readonly fields: any) {
    Object.assign(this, fields);
  }
}

export class TransferRemoteInstruction {
  destination_domain!: number;
  recipient!: Uint8Array;
  recipient_pubkey!: PublicKey;
  amount_or_id!: number;
  constructor(public readonly fields: any) {
    Object.assign(this, fields);
    this.recipient_pubkey = new PublicKey(this.recipient);
  }
}

export const TransferRemoteSchema = new Map<any, any>([
  [
    TransferRemoteWrapper,
    {
      kind: 'struct',
      fields: [
        ['instruction', 'u8'],
        ['data', TransferRemoteInstruction],
      ],
    },
  ],
  [
    TransferRemoteInstruction,
    {
      kind: 'struct',
      fields: [
        ['destination_domain', 'u32'],
        ['recipient', [32]],
        ['amount_or_id', 'u256'],
      ],
    },
  ],
]);
