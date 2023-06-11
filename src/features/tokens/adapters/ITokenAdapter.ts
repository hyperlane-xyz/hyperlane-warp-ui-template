export interface TransferParams {
  amountOrId: string | number;
  recipient: Address;

  // Solana-specific params
  // Included here optionally to keep Adapter types simple
  fromTokenAccount?: Address;
  fromAccountOwner?: Address;
}

export interface TransferRemoteParams extends TransferParams {
  destination: DomainId;
  txValue?: string;
}

export interface ITokenAdapter {
  getBalance(address?: Address): Promise<string>;
  getMetadata(isNft?: boolean): Promise<{ decimals: number; symbol: string; name: string }>;
  prepareApproveTx(TransferParams: TransferParams): unknown | Promise<unknown>;
  prepareTransferTx(TransferParams: TransferParams): unknown | Promise<unknown>;
}

export interface IHypTokenAdapter extends ITokenAdapter {
  getDomains(): Promise<DomainId[]>;
  getRouterAddress(domain: DomainId): Promise<Address>;
  getAllRouters(): Promise<Array<{ domain: DomainId; address: Address }>>;
  quoteGasPayment(destination: DomainId): Promise<string>;
  prepareTransferRemoteTx(TransferParams: TransferRemoteParams): unknown | Promise<unknown>;
}
