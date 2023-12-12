import { ProtocolType } from '@hyperlane-xyz/utils';

export interface ChainAddress {
  address: string;
  chainCaip2Id?: ChainCaip2Id;
}

export interface AccountInfo {
  protocol: ProtocolType;
  // This needs to be an array instead of a single address b.c.
  // Cosmos wallets have different addresses per chain
  addresses: Array<ChainAddress>;
  connectorName?: string;
  isReady: boolean;
}

export interface ActiveChainInfo {
  chainDisplayName?: string;
  chainCaip2Id?: ChainCaip2Id;
}

export type SendTransactionFn<TxReq = any, TxResp = any> = (params: {
  tx: TxReq;
  chainCaip2Id: ChainCaip2Id;
  activeCap2Id?: ChainCaip2Id;
}) => Promise<{ hash: string; confirm: () => Promise<TxResp> }>;

export type SwitchNetworkFn = (chainCaip2Id: ChainCaip2Id) => Promise<void>;

export interface ChainTransactionFns {
  sendTransaction: SendTransactionFn;
  switchNetwork?: SwitchNetworkFn;
}
