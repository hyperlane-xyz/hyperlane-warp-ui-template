import { MinimalTokenMetadata } from '../types';

export interface TransferParams {
  amountOrId: string | number;
  recipient: Address;

  // Solana-specific params
  // Included here optionally to keep Adapter types simple
  fromTokenAccount?: Address;
  fromAccountOwner?: Address;
  mailbox?: Address;
}

export interface TransferRemoteParams extends TransferParams {
  destination: DomainId;
  txValue?: string;
}

export interface ITokenAdapter {
  getBalance(address?: Address): Promise<string>;
  getMetadata(isNft?: boolean): Promise<MinimalTokenMetadata>;
  populateApproveTx(TransferParams: TransferParams): unknown | Promise<unknown>;
  populateTransferTx(TransferParams: TransferParams): unknown | Promise<unknown>;
}

export interface IHypTokenAdapter extends ITokenAdapter {
  getDomains(): Promise<DomainId[]>;
  getRouterAddress(domain: DomainId): Promise<Address>;
  getAllRouters(): Promise<Array<{ domain: DomainId; address: Address }>>;
  quoteGasPayment(destination: DomainId): Promise<string>;
  populateTransferRemoteTx(TransferParams: TransferRemoteParams): unknown | Promise<unknown>;
}
