export interface TransferFormValues {
  sourceChainId: number;
  destinationChainId: number;
  amount: string;
  tokenAddress: Address;
  hypCollateralAddress: Address;
  recipientAddress: Address;
}
