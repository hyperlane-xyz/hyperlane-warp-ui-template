/* eslint-disable @typescript-eslint/no-unused-vars */
import { createTransferInstruction } from '@solana/spl-token';
import {
  Cluster,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { deserializeUnchecked } from 'borsh';

import {
  IHypTokenAdapter,
  ITokenAdapter,
  TransferParams,
  TransferRemoteParams,
} from './ITokenAdapter';

interface NativeTransferParams {
  recipient: Address;
  amountOrId: string | number;
  fromAccount?: Address;
}

interface IAccountDataWrapper {
  initialized: boolean;
  data: IHyperlaneTokenData;
}

// Should match https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/trevor/sealevel-validator-rebase/rust/sealevel/libraries/hyperlane-sealevel-token/src/accounts.rs#L21
interface IHyperlaneTokenData {
  /// The bump seed for this PDA.
  bump: number;
  /// The address of the mailbox contract.
  mailbox: Address;
  /// The Mailbox process authority specific to this program as the recipient.
  mailbox_process_authority: Address;
  /// The dispatch authority PDA's bump seed.
  dispatch_authority_bump: number;
  /// The decimals of the local token.
  decimals: number;
  /// The decimals of the remote token.
  remote_decimals: number;
  /// Access control owner.
  owner: Address;
  /// The interchain security module.
  interchain_security_module: Address;
  /// Remote routers.
  remote_routers: any;
  /// Plugin-specific data.
  plugin_data: any;
}

class AccountDataWrapper {
  initialized!: boolean;
  data!: HyperlaneTokenData;
  constructor(public readonly fields: IAccountDataWrapper) {
    Object.assign(this, fields);
  }
}

class HyperlaneTokenData {
  bump!: number;
  mailbox!: Uint8Array;
  mailbox_pubkey!: PublicKey;
  mailbox_process_authority!: Uint8Array;
  mailbox_process_authority_pubkey!: PublicKey;
  dispatch_authority_bump!: number;
  decimals!: number;
  remote_decimals!: number;
  owner?: Uint8Array;
  owner_pub_key?: PublicKey;
  interchain_security_module?: Uint8Array;
  interchain_security_module_pubkey?: PublicKey;
  remote_routers?: Map<DomainId, Uint8Array>;
  remote_router_pubkeys: Map<DomainId, PublicKey>;
  constructor(public readonly fields: IHyperlaneTokenData) {
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

const HyperlaneTokenDataSchema = new Map<any, any>([
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

// Interacts with native currencies
export class SealevelNativeTokenAdapter implements ITokenAdapter {
  public readonly connection: Connection;

  constructor(public readonly clusterName: Cluster, public readonly signerAddress?: Address) {
    this.connection = new Connection(clusterApiUrl(clusterName), 'confirmed');
  }

  async getBalance(address?: Address): Promise<string> {
    const pubKey = resolveAddress(address, this.signerAddress);
    const balance = await this.connection.getBalance(pubKey);
    return balance.toString();
  }

  async getMetadata(): Promise<{ decimals: number; symbol: string; name: string }> {
    throw new Error('Metadata not available to native tokens');
  }

  prepareApproveTx(_params: NativeTransferParams): Transaction {
    throw new Error('Approve not required for native tokens');
  }

  prepareTransferTx({ amountOrId, recipient, fromAccount }: NativeTransferParams): Transaction {
    const fromPubkey = resolveAddress(fromAccount, this.signerAddress);
    return new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey: new PublicKey(recipient),
        lamports: new BigNumber(amountOrId).toNumber(),
      }),
    );
  }
}

// Interacts with SPL token programs
export class SealevelTokenAdapter implements ITokenAdapter {
  public readonly connection: Connection;
  public readonly tokenPda: PublicKey;

  constructor(
    public readonly clusterName: Cluster,
    public readonly programId: Address,
    public readonly signerAddress?: Address,
  ) {
    this.connection = new Connection(clusterApiUrl(clusterName), 'confirmed');
    this.tokenPda = this.deriveTokenAccount();
  }

  async getBalance(tokenAccount: Address): Promise<string> {
    // TODO consider fetching tokenAccount manually or moving to constructor params
    const balance = await this.connection.getTokenAccountBalance(new PublicKey(tokenAccount));
    return balance.toString();
  }

  async getMetadata(isNft?: boolean): Promise<{ decimals: number; symbol: string; name: string }> {
    // TODO solana support
    return { decimals: 9, symbol: 'SPL', name: 'SPL Token' };
  }

  prepareApproveTx(_params: TransferParams): Promise<Transaction> {
    throw new Error('Approve not required for native tokens');
  }

  prepareTransferTx({
    amountOrId,
    recipient,
    fromAccountOwner,
    fromTokenAccount,
  }: TransferParams): Transaction {
    if (!fromTokenAccount) throw new Error('No fromTokenAccount provided');
    const fromWalletPk = resolveAddress(fromAccountOwner, this.signerAddress);
    return new Transaction().add(
      createTransferInstruction(
        new PublicKey(fromTokenAccount),
        new PublicKey(recipient),
        fromWalletPk,
        new BigNumber(amountOrId).toNumber(),
      ),
    );
  }

  // Should match https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/trevor/sealevel-validator-rebase/rust/sealevel/libraries/hyperlane-sealevel-token/src/processor.rs#LL49C1-L53C30
  deriveTokenAccount(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('hyperlane_message_recipient'),
        Buffer.from('-'),
        Buffer.from('handle'),
        Buffer.from('-'),
        Buffer.from('account_metas'),
      ],
      new PublicKey(this.programId),
    );
    return pda;
  }
}

// Interacts with SPL token programs
export class SealevelHypTokenAdapter extends SealevelTokenAdapter implements IHypTokenAdapter {
  async getDomains(): Promise<DomainId[]> {
    // TODO Solana support
    return [];
  }

  async getRouterAddress(domain: DomainId): Promise<Address> {
    // TODO Solana support
    return '';
  }

  async getAllRouters(): Promise<Array<{ domain: DomainId; address: Address }>> {
    const accountInfo = await this.connection.getAccountInfo(this.tokenPda);
    if (!accountInfo) throw new Error(`No account info found for ${this.tokenPda}}`);
    const tokenData = deserializeUnchecked(
      HyperlaneTokenDataSchema,
      AccountDataWrapper,
      accountInfo.data,
    );
    const domainToPubKey = tokenData.data.remote_router_pubkeys;
    return Array.from(domainToPubKey.entries()).map(([domain, pubKey]) => ({
      domain,
      address: pubKey.toBase58(),
    }));
  }

  async quoteGasPayment(destination: DomainId): Promise<string> {
    // TODO Solana support
    return '0';
  }

  prepareTransferRemoteTx({
    amountOrId,
    destination,
    recipient,
    txValue,
  }: TransferRemoteParams): Promise<Transaction> {
    throw new Error('TODO solana');
  }
}

function resolveAddress(address1?: Address, address2?: Address): PublicKey {
  if (address1) return new PublicKey(address1);
  else if (address2) return new PublicKey(address2);
  else throw new Error('No address provided');
}

interface RpcResponse<R> {
  id: number;
  jsonrpc: '2.0';
  result: {
    context: {
      slot: number;
      apiVersion: string;
    };
    value: R;
  };
}

let reqId = 1;
// TODO remove?
async function fetchChainData<R>(rpc: string, method: string, params: any[]) {
  const response = (await fetch(rpc, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: reqId++,
      method,
      params,
    }),
  }).then((res) => res.json())) as RpcResponse<R>;
  return response.result.value;
}
