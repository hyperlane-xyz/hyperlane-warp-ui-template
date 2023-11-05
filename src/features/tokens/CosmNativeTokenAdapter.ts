import { MsgTransferEncodeObject } from '@cosmjs/stargate';
import { MsgTransfer } from 'cosmjs-types/ibc/applications/transfer/v1/tx';

import {
  BaseAppAdapter,
  CosmJsProvider,
  ITokenAdapter,
  MinimalTokenMetadata,
  MultiProtocolProvider,
  TransferParams,
} from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

// TODO cosmos move everything in this file to the SDK
export class BaseCosmosAdapter extends BaseAppAdapter {
  public readonly protocol: ProtocolType = ProtocolType.Cosmos;

  public getProvider(): CosmJsProvider['provider'] {
    return this.multiProvider.getCosmJsProvider(this.chainName);
  }
}

export class CosmNativeTokenAdapter extends BaseCosmosAdapter implements ITokenAdapter {
  constructor(
    public readonly chainName: string,
    public readonly multiProvider: MultiProtocolProvider,
    public readonly addresses: Record<string, Address>,
    public readonly properties: {
      ibcDenom: string;
      sourcePort: string;
      sourceChannel: string;
    },
  ) {
    if (!properties.ibcDenom || !properties.sourcePort || !properties.sourceChannel)
      throw new Error('Missing properties for CosmNativeTokenAdapter');
    super(chainName, multiProvider, addresses);
  }

  async getBalance(address: string): Promise<string> {
    const provider = await this.getProvider();
    const coin = await provider.getBalance(address, this.properties.ibcDenom);
    return coin.amount;
  }

  getMetadata(): Promise<MinimalTokenMetadata> {
    throw new Error('Metadata not available to native tokens');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  populateApproveTx(_transferParams: TransferParams): unknown {
    throw new Error('Approve not required for native tokens');
  }

  async populateTransferTx(transferParams: TransferParams): Promise<MsgTransferEncodeObject> {
    if (!transferParams.fromAccountOwner)
      throw new Error('fromAccountOwner is required for ibc transfers');
    const transfer: MsgTransfer = {
      sourcePort: this.properties.sourcePort,
      sourceChannel: this.properties.sourceChannel,
      token: {
        denom: this.properties.ibcDenom,
        amount: transferParams.weiAmountOrId.toString(),
      },
      sender: transferParams.fromAccountOwner,
      receiver: transferParams.recipient,
      timeoutHeight: {
        revisionNumber: 0n,
        revisionHeight: 0n,
      },
      timeoutTimestamp: 0n,
      memo: '',
    };
    return {
      typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
      //@ts-ignore mismatched bigint/number types aren't a problem
      value: transfer,
    };
  }
}
