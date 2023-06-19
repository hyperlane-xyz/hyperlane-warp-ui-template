/* eslint-disable @typescript-eslint/no-unused-vars */
import { createTransferInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import {
  AccountMeta,
  Cluster,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { deserializeUnchecked, serialize } from 'borsh';

import { SOL_SPL_NOOP_ADDRESS } from '../../../consts/values';
import {
  AccountDataWrapper,
  HyperlaneTokenDataSchema,
  TransferRemoteInstruction,
  TransferRemoteSchema,
  TransferRemoteWrapper,
} from '../contracts/sealevelSerialization';

import {
  IHypTokenAdapter,
  ITokenAdapter,
  TransferParams,
  TransferRemoteParams,
} from './ITokenAdapter';

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

  prepareApproveTx(_params: TransferParams): Transaction {
    throw new Error('Approve not required for native tokens');
  }

  prepareTransferTx({ amountOrId, recipient, fromAccountOwner }: TransferParams): Transaction {
    const fromPubkey = resolveAddress(fromAccountOwner, this.signerAddress);
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
  public readonly programIdPubKey: PublicKey;

  constructor(
    public readonly clusterName: Cluster,
    public readonly programId: Address,
    public readonly signerAddress?: Address,
  ) {
    this.connection = new Connection(clusterApiUrl(clusterName), 'confirmed');
    this.programIdPubKey = new PublicKey(programId);
  }

  async getBalance(owner: Address): Promise<string> {
    if (owner) return '0'; // TODO fix
    const tokenPubKey = getAssociatedTokenAddressSync(
      new PublicKey(owner), // TODO use mint?
      new PublicKey(owner),
    );
    // const tokenAccount = await getAccount(this.connection, associatedToken);
    // TODO consider fetching tokenAccount manually or moving to constructor params
    const balance = await this.connection.getTokenAccountBalance(tokenPubKey);
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
    const fromWalletPubKey = resolveAddress(fromAccountOwner, this.signerAddress);
    return new Transaction().add(
      createTransferInstruction(
        new PublicKey(fromTokenAccount),
        new PublicKey(recipient),
        fromWalletPubKey,
        new BigNumber(amountOrId).toNumber(),
      ),
    );
  }
}

// Interacts with SPL token programs
export class SealevelHypTokenAdapter extends SealevelTokenAdapter implements IHypTokenAdapter {
  constructor(
    public readonly clusterName: Cluster,
    public readonly programId: Address,
    public readonly signerAddress?: Address,
  ) {
    super(clusterName, programId, signerAddress);
  }

  async getDomains(): Promise<DomainId[]> {
    const routers = await this.getAllRouters();
    return routers.map((router) => router.domain);
  }

  async getRouterAddress(domain: DomainId): Promise<Address> {
    const routers = await this.getAllRouters();
    const addr = routers.find((router) => router.domain === domain)?.address;
    if (!addr) throw new Error(`No router found for ${domain}`);
    return addr;
  }

  async getAllRouters(): Promise<Array<{ domain: DomainId; address: Address }>> {
    const tokenPda = this.deriveHypTokenAccount();
    const accountInfo = await this.connection.getAccountInfo(tokenPda);
    if (!accountInfo) throw new Error(`No account info found for ${tokenPda}}`);
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

  async prepareTransferRemoteTx({
    amountOrId,
    destination,
    recipient,
    fromAccountOwner,
    mailbox,
  }: TransferRemoteParams): Promise<Transaction> {
    if (!mailbox) throw new Error('No mailbox provided');
    const fromWalletPubKey = resolveAddress(fromAccountOwner, this.signerAddress);
    const randomWallet = Keypair.generate();
    const mailboxPubKey = new PublicKey(mailbox);

    // 0.   [executable] The system program.
    // 1.   [executable] The spl_noop program.
    // 2.   [] The token PDA account.
    // 3.   [executable] The mailbox program.
    // 4.   [writeable] The mailbox outbox account.
    // 5.   [] Message dispatch authority.
    // 6.   [signer] The token sender and mailbox payer.
    // 7.   [signer] Unique message account.
    // 8.   [writeable] Message storage PDA.
    // 9.   [executable] The system program.
    // 10.  [writeable] The native token collateral PDA account.
    const keys: Array<AccountMeta> = [
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(SOL_SPL_NOOP_ADDRESS), isSigner: false, isWritable: false },
      { pubkey: this.deriveHypTokenAccount(), isSigner: false, isWritable: false },
      { pubkey: mailboxPubKey, isSigner: false, isWritable: false },
      { pubkey: this.deriveMailboxOutboxAccount(mailboxPubKey), isSigner: false, isWritable: true },
      { pubkey: this.deriveMessageDispatchAuthorityAccount(), isSigner: false, isWritable: false },
      { pubkey: fromWalletPubKey, isSigner: true, isWritable: false },
      { pubkey: randomWallet.publicKey, isSigner: true, isWritable: false },
      // prettier-ignore
      { pubkey: this.deriveMsgStorageAccount(mailboxPubKey, randomWallet.publicKey), isSigner: false, isWritable: true, },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: this.deriveNativeTokenCollateralAccount(), isSigner: false, isWritable: true },
    ];

    const value = new TransferRemoteWrapper({
      instruction: 1,
      data: new TransferRemoteInstruction({
        destination_domain: destination,
        recipient: new PublicKey(recipient).toBytes(),
        amount_or_id: new BigNumber(amountOrId).toNumber(),
      }),
    });
    const serializedData = serialize(TransferRemoteSchema, value);

    const transferRemoteInstruction = new TransactionInstruction({
      keys,
      programId: this.programIdPubKey,
      data: Buffer.concat([Buffer.from([1, 1, 1, 1, 1, 1, 1, 1]), Buffer.from(serializedData)]),
    });

    const recentBlockhash = (await this.connection.getLatestBlockhash('finalized')).blockhash;
    // @ts-ignore Workaround for bug in the web3 lib, sometimes uses recentBlockhash and sometimes uses blockhash
    const tx = new Transaction({
      feePayer: fromWalletPubKey,
      blockhash: recentBlockhash,
      recentBlockhash,
    }).add(transferRemoteInstruction);
    tx.partialSign(randomWallet);
    return tx;
  }

  // Should match https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/trevor/sealevel-validator-rebase/rust/sealevel/libraries/hyperlane-sealevel-token/src/processor.rs#LL49C1-L53C30
  deriveHypTokenAccount(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('hyperlane_message_recipient'),
        Buffer.from('-'),
        Buffer.from('handle'),
        Buffer.from('-'),
        Buffer.from('account_metas'),
      ],
      this.programIdPubKey,
    );
    return pda;
  }

  // https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/trevor/sealevel-validator-rebase/rust/sealevel/programs/mailbox/src/pda_seeds.rs#L19
  deriveMailboxOutboxAccount(mailbox: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('hyperlane'), Buffer.from('-'), Buffer.from('outbox')],
      mailbox,
    );
    return pda;
  }

  // https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/trevor/sealevel-validator-rebase/rust/sealevel/programs/mailbox/src/pda_seeds.rs#L57
  deriveMessageDispatchAuthorityAccount(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('hyperlane_dispatcher'), Buffer.from('-'), Buffer.from('dispatch_authority')],
      this.programIdPubKey,
    );
    return pda;
  }

  // https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/trevor/sealevel-validator-rebase/rust/sealevel/programs/mailbox/src/pda_seeds.rs#L33-L37
  deriveMsgStorageAccount(mailbox: PublicKey, randomWalletPubKey: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('hyperlane'),
        Buffer.from('-'),
        Buffer.from('dispatched_message'),
        Buffer.from('-'),
        randomWalletPubKey.toBuffer(),
      ],
      mailbox,
    );
    return pda;
  }

  // https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/trevor/sealevel-validator-rebase/rust/sealevel/programs/hyperlane-sealevel-token-native/src/plugin.rs#L26
  deriveNativeTokenCollateralAccount(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('hyperlane_token'), Buffer.from('-'), Buffer.from('native_collateral')],
      this.programIdPubKey,
    );
    return pda;
  }
}

function resolveAddress(address1?: Address, address2?: Address): PublicKey {
  if (address1) return new PublicKey(address1);
  else if (address2) return new PublicKey(address2);
  else throw new Error('No address provided');
}
