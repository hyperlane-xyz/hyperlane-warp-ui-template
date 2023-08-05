/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  AccountMeta,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { deserializeUnchecked, serialize } from 'borsh';

import { SOL_SPL_NOOP_ADDRESS } from '../../../consts/values';
import { addressToBytes, isZeroishAddress } from '../../../utils/addresses';
import {
  AccountDataWrapper,
  HypTokenInstruction,
  HyperlaneTokenDataSchema,
  TransferRemoteInstruction,
  TransferRemoteSchema,
  TransferRemoteWrapper,
} from '../contracts/sealevelSerialization';
import { MinimalTokenMetadata } from '../types';

import {
  IHypTokenAdapter,
  ITokenAdapter,
  TransferParams,
  TransferRemoteParams,
} from './ITokenAdapter';

// Interacts with native currencies
export class SealevelNativeTokenAdapter implements ITokenAdapter {
  constructor(public readonly connection: Connection, public readonly signerAddress?: Address) {}

  async getBalance(address?: Address): Promise<string> {
    const pubKey = resolveAddress(address, this.signerAddress);
    const balance = await this.connection.getBalance(pubKey);
    return balance.toString();
  }

  async getMetadata(): Promise<MinimalTokenMetadata> {
    throw new Error('Metadata not available to native tokens');
  }

  populateApproveTx(_params: TransferParams): Transaction {
    throw new Error('Approve not required for native tokens');
  }

  populateTransferTx({ amountOrId, recipient, fromAccountOwner }: TransferParams): Transaction {
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
  public readonly tokenProgramPubKey: PublicKey;

  constructor(
    public readonly connection: Connection,
    public readonly tokenProgramId: Address,
    public readonly isSpl2022: boolean = false,
    public readonly signerAddress?: Address,
  ) {
    this.tokenProgramPubKey = new PublicKey(tokenProgramId);
  }

  async getBalance(owner: Address): Promise<string> {
    const tokenPubKey = this.deriveAssociatedTokenAccount(new PublicKey(owner));
    const response = await this.connection.getTokenAccountBalance(tokenPubKey);
    return response.value.amount;
  }

  async getMetadata(isNft?: boolean): Promise<MinimalTokenMetadata> {
    // TODO solana support
    return { decimals: 9, symbol: 'SPL', name: 'SPL Token' };
  }

  populateApproveTx(_params: TransferParams): Promise<Transaction> {
    throw new Error('Approve not required for sealevel tokens');
  }

  populateTransferTx({
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

  getTokenProgramId(): PublicKey {
    return this.isSpl2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  }

  deriveAssociatedTokenAccount(owner: PublicKey): PublicKey {
    return getAssociatedTokenAddressSync(
      this.tokenProgramPubKey,
      owner,
      true,
      this.getTokenProgramId(),
    );
  }
}

export abstract class SealevelHypTokenAdapter
  extends SealevelTokenAdapter
  implements IHypTokenAdapter
{
  public readonly warpProgramPubKey: PublicKey;

  constructor(
    public readonly connection: Connection,
    public readonly warpRouteProgramId: Address,
    public readonly tokenProgramId: Address,
    public readonly isSpl2022: boolean = false,
    public readonly signerAddress?: Address,
  ) {
    // Pass in placeholder address to avoid errors for native token addresses (which as represented here as 0s)
    const superTokenProgramId = isZeroishAddress(tokenProgramId)
      ? SystemProgram.programId.toBase58()
      : tokenProgramId;
    super(connection, superTokenProgramId, isSpl2022, signerAddress);
    this.warpProgramPubKey = new PublicKey(warpRouteProgramId);
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

  async populateTransferRemoteTx({
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
    const keys = this.getTransferInstructionKeyList(
      fromWalletPubKey,
      mailboxPubKey,
      randomWallet.publicKey,
    );

    const value = new TransferRemoteWrapper({
      instruction: HypTokenInstruction.TransferRemote,
      data: new TransferRemoteInstruction({
        destination_domain: destination,
        recipient: addressToBytes(recipient),
        amount_or_id: new BigNumber(amountOrId).toNumber(),
      }),
    });
    const serializedData = serialize(TransferRemoteSchema, value);

    const transferRemoteInstruction = new TransactionInstruction({
      keys,
      programId: this.warpProgramPubKey,
      // Array of 1s is an arbitrary 8 byte "discriminator"
      // https://github.com/hyperlane-xyz/issues/issues/462#issuecomment-1587859359
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

  getTransferInstructionKeyList(
    sender: PublicKey,
    mailbox: PublicKey,
    randomWallet: PublicKey,
  ): Array<AccountMeta> {
    return [
      // 0.   [executable] The system program.
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      // 1.   [executable] The spl_noop program.
      { pubkey: new PublicKey(SOL_SPL_NOOP_ADDRESS), isSigner: false, isWritable: false },
      // 2.   [] The token PDA account.
      { pubkey: this.deriveHypTokenAccount(), isSigner: false, isWritable: false },
      // 3.   [executable] The mailbox program.
      { pubkey: mailbox, isSigner: false, isWritable: false },
      // 4.   [writeable] The mailbox outbox account.
      { pubkey: this.deriveMailboxOutboxAccount(mailbox), isSigner: false, isWritable: true },
      // 5.   [] Message dispatch authority.
      { pubkey: this.deriveMessageDispatchAuthorityAccount(), isSigner: false, isWritable: false },
      // 6.   [signer] The token sender and mailbox payer.
      { pubkey: sender, isSigner: true, isWritable: false },
      // 7.   [signer] Unique message account.
      { pubkey: randomWallet, isSigner: true, isWritable: false },
      // 8.   [writeable] Message storage PDA.
      // prettier-ignore
      { pubkey: this.deriveMsgStorageAccount(mailbox, randomWallet), isSigner: false, isWritable: true, },
    ];
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
      this.warpProgramPubKey,
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
      this.warpProgramPubKey,
    );
    return pda;
  }
}

// Interacts with Hyp Native token programs
export class SealevelHypNativeAdapter extends SealevelHypTokenAdapter {
  public readonly wrappedNative: SealevelNativeTokenAdapter;

  constructor(
    public readonly connection: Connection,
    public readonly warpRouteProgramId: Address,
    public readonly tokenProgramId: Address,
    public readonly isSpl2022: boolean = false,
    public readonly signerAddress?: Address,
  ) {
    super(connection, warpRouteProgramId, tokenProgramId, isSpl2022, signerAddress);
    this.wrappedNative = new SealevelNativeTokenAdapter(connection, signerAddress);
  }

  override async getBalance(owner: Address): Promise<string> {
    return this.wrappedNative.getBalance(owner);
  }

  override async getMetadata(): Promise<MinimalTokenMetadata> {
    return this.wrappedNative.getMetadata();
  }

  getTransferInstructionKeyList(
    sender: PublicKey,
    mailbox: PublicKey,
    randomWallet: PublicKey,
  ): Array<AccountMeta> {
    return [
      ...super.getTransferInstructionKeyList(sender, mailbox, randomWallet),
      // 9.   [executable] The system program.
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      // 10.  [writeable] The native token collateral PDA account.
      { pubkey: this.deriveNativeTokenCollateralAccount(), isSigner: false, isWritable: true },
    ];
  }

  // https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/trevor/sealevel-validator-rebase/rust/sealevel/programs/hyperlane-sealevel-token-native/src/plugin.rs#L26
  deriveNativeTokenCollateralAccount(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('hyperlane_token'), Buffer.from('-'), Buffer.from('native_collateral')],
      this.warpProgramPubKey,
    );
    return pda;
  }
}

// Interacts with Hyp Collateral token programs
export class SealevelHypCollateralAdapter extends SealevelHypTokenAdapter {
  override getTransferInstructionKeyList(
    sender: PublicKey,
    mailbox: PublicKey,
    randomWallet: PublicKey,
  ): Array<AccountMeta> {
    return [
      ...super.getTransferInstructionKeyList(sender, mailbox, randomWallet),
      /// 9.   [executable] The SPL token program for the mint.
      { pubkey: this.getTokenProgramId(), isSigner: false, isWritable: false },
      /// 10.  [writeable] The mint.
      { pubkey: this.tokenProgramPubKey, isSigner: false, isWritable: true },
      /// 11.  [writeable] The token sender's associated token account, from which tokens will be sent.
      { pubkey: this.deriveAssociatedTokenAccount(sender), isSigner: false, isWritable: true },
      /// 12.  [writeable] The escrow PDA account.
      { pubkey: this.deriveEscrowAccount(), isSigner: false, isWritable: true },
    ];
  }

  deriveEscrowAccount(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('hyperlane_token'), Buffer.from('-'), Buffer.from('escrow')],
      this.warpProgramPubKey,
    );
    return pda;
  }
}

// Interacts with Hyp Synthetic token programs (aka 'HypTokens')
export class SealevelHypSyntheticAdapter extends SealevelHypTokenAdapter {
  override getTransferInstructionKeyList(
    sender: PublicKey,
    mailbox: PublicKey,
    randomWallet: PublicKey,
  ): Array<AccountMeta> {
    return [
      ...super.getTransferInstructionKeyList(sender, mailbox, randomWallet),
      /// 9. [executable] The spl_token_2022 program.
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      /// 10. [writeable] The mint / mint authority PDA account.
      { pubkey: this.deriveMintAuthorityAccount(), isSigner: false, isWritable: true },
      /// 11. [writeable] The token sender's associated token account, from which tokens will be burned.
      { pubkey: this.deriveAssociatedTokenAccount(sender), isSigner: false, isWritable: true },
    ];
  }

  override async getBalance(owner: Address): Promise<string> {
    const tokenPubKey = this.deriveAssociatedTokenAccount(new PublicKey(owner));
    const response = await this.connection.getTokenAccountBalance(tokenPubKey);
    return response.value.amount;
  }

  deriveMintAuthorityAccount(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('hyperlane_token'), Buffer.from('-'), Buffer.from('mint')],
      this.warpProgramPubKey,
    );
    return pda;
  }

  override deriveAssociatedTokenAccount(owner: PublicKey): PublicKey {
    return getAssociatedTokenAddressSync(
      this.deriveMintAuthorityAccount(),
      new PublicKey(owner),
      true,
      TOKEN_2022_PROGRAM_ID,
    );
  }
}

function resolveAddress(address1?: Address, address2?: Address): PublicKey {
  if (address1) return new PublicKey(address1);
  else if (address2) return new PublicKey(address2);
  else throw new Error('No address provided');
}
