export interface ITokenAdapter {
  getBalance(address?: Address): Promise<string>;
  getMetadata(isNft?: boolean): Promise<{ decimals: number; symbol: string; name: string }>;
  prepareApproveTx(recipient: Address, amountOrId: string | number): Promise<{ tx: any }>;
  prepareTransferTx(recipient: Address, amountOrId: string | number): Promise<{ tx: any }>;
}

export interface IHypTokenAdapter extends ITokenAdapter {
  getDomains(): Promise<DomainId[]>;
  getRouterAddress(domain: DomainId): Promise<Address>;
  getAllRouters(): Promise<Array<{ domain: DomainId; address: Address }>>;
  quoteGasPayment(destination: DomainId): Promise<string>;
  prepareTransferRemoteTx(
    destination: DomainId,
    recipient: Address,
    amountOrId: string | number,
  ): Promise<{ tx: any }>;
}
