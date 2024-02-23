import { ProtocolType } from '@hyperlane-xyz/utils';

export interface ChainAddress {
  address: string;
  chainName?: ChainName;
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
  chainName?: ChainName;
}

export type SendTransactionFn<TxReq = any, TxResp = any> = (params: {
  tx: TxReq;
  chainName: ChainName;
  activeChainName?: ChainName;
  clientType?: string;
}) => Promise<{ hash: string; confirm: () => Promise<TxResp> }>;

export type SwitchNetworkFn = (chainName: ChainName) => Promise<void>;

export interface ChainTransactionFns {
  sendTransaction: SendTransactionFn;
  switchNetwork?: SwitchNetworkFn;
}
