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

  constructor(public readonly clusterName: Cluster, public readonly signerAddress?: Address) {
    this.connection = new Connection(clusterApiUrl(clusterName), 'confirmed');
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
    // TODO Solana support
    return [];
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
