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
    public readonly ibcDenom: string = 'utia', // TODO cosmos update to be generic
  ) {
    super(chainName, multiProvider, addresses);
  }

  async getBalance(address: string): Promise<string> {
    const provider = await this.getProvider();
    const coin = await provider.getBalance(address, this.ibcDenom);
    return coin.amount;
  }

  getMetadata(): Promise<MinimalTokenMetadata> {
    throw new Error('Metadata not available to native tokens');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  populateApproveTx(_transferParams: TransferParams): unknown {
    throw new Error('Approve not required for native tokens');
  }

  // @ts-ignore
  async populateTransferTx(
    transferParams: TransferParams,
    memo: any,
  ): Promise<MsgTransferEncodeObject> {
    const provider = await this.getProvider();
    const revisionHeight = await provider.getHeight();
    console.log('populate', this.chainName);
    const transfer: MsgTransfer = {
      sourcePort: 'transfer',
      sourceChannel: 'channel-8',
      token: {
        denom: this.ibcDenom,
        amount: transferParams.weiAmountOrId.toString(),
      },
      sender: 'celestia1dwnrgwsf5c9vqjxsax04pdm0mx007yrrvqukv3',
      receiver: 'celestia1dwnrgwsf5c9vqjxsax04pdm0mx007yrrvqukv3',
      // @ts-ignore
      timeoutHeight: undefined,
      timeoutTimestamp: BigInt(new Date().getTime() + 60000),
    };
    return {
      typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
      //@ts-ignore mismatched bigint/number types aren't a problem
      value: transfer,
      memo,
    };
  }
}
