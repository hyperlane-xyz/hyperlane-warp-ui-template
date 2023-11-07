import { MsgTransferEncodeObject } from '@cosmjs/stargate';
import Long from 'long';

import {
  BaseAppAdapter,
  ChainName,
  CosmJsProvider,
  CwHypCollateralAdapter,
  IHypTokenAdapter,
  ITokenAdapter,
  MinimalTokenMetadata,
  MultiProtocolProvider,
  TransferParams,
  TransferRemoteParams,
} from '@hyperlane-xyz/sdk';
import { Domain, ProtocolType } from '@hyperlane-xyz/utils';

const COSMOS_IBC_TRANSFER_TIMEOUT = 60_000; // 1 minute

// TODO cosmos move everything in this file to the SDK
export class BaseCosmosAdapter extends BaseAppAdapter {
  public readonly protocol: ProtocolType = ProtocolType.Cosmos;

  public getProvider(): CosmJsProvider['provider'] {
    return this.multiProvider.getCosmJsProvider(this.chainName);
  }
}

export class CosmNativeTokenAdapter extends BaseCosmosAdapter implements ITokenAdapter {
  constructor(
    public readonly chainName: ChainName,
    public readonly multiProvider: MultiProtocolProvider,
    public readonly addresses: Record<string, Address>,
    public readonly properties: {
      ibcDenom: string;
    },
  ) {
    if (!properties.ibcDenom) throw new Error('Missing properties for CosmNativeTokenAdapter');
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

  // TODO cosmos consider refactoring this into a new method b.c. the other adapter
  // transfer methods are for local chain transfers, not remote ones
  async populateTransferTx(_transferParams: TransferParams): Promise<MsgTransferEncodeObject> {
    throw new Error('TODO not yet implemented');
  }
}

export class CosmIbcTokenAdapter extends CosmNativeTokenAdapter implements IHypTokenAdapter {
  constructor(
    public readonly chainName: ChainName,
    public readonly multiProvider: MultiProtocolProvider,
    public readonly addresses: Record<string, Address>,
    public readonly properties: {
      ibcDenom: string;
      sourcePort: string;
      sourceChannel: string;
    },
  ) {
    if (!properties.ibcDenom || !properties.sourcePort || !properties.sourceChannel)
      throw new Error('Missing properties for CosmNativeIbcTokenAdapter');
    super(chainName, multiProvider, addresses, properties);
  }

  getDomains(): Promise<Domain[]> {
    throw new Error('Method not applicable to IBC adapters');
  }
  getRouterAddress(_domain: Domain): Promise<Buffer> {
    throw new Error('Method not applicable to IBC adapters');
  }
  getAllRouters(): Promise<
    Array<{
      domain: Domain;
      address: Buffer;
    }>
  > {
    throw new Error('Method not applicable to IBC adapters');
  }
  quoteGasPayment(_destination: Domain): Promise<string> {
    throw new Error('Method not applicable to IBC adapters');
  }

  // TODO cosmos consider refactoring this into a new method b.c. the other adapter
  // transfer methods are for local chain transfers, not remote ones
  async populateTransferRemoteTx(
    transferParams: TransferRemoteParams,
    memo = '',
  ): Promise<MsgTransferEncodeObject> {
    if (!transferParams.fromAccountOwner)
      throw new Error('fromAccountOwner is required for ibc transfers');

    const value = {
      sourcePort: this.properties.sourcePort,
      sourceChannel: this.properties.sourceChannel,
      token: {
        denom: this.properties.ibcDenom,
        amount: transferParams.weiAmountOrId.toString(),
      },
      sender: transferParams.fromAccountOwner,
      receiver: transferParams.recipient,
      // Represented as nano-seconds
      timeoutTimestamp: Long.fromNumber(
        new Date().getTime() + COSMOS_IBC_TRANSFER_TIMEOUT,
      ).multiply(1_000_000),
      memo,
    };
    return {
      typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
      value,
    };
  }
}

export class CosmIbcToWarpTokenAdapter extends CosmIbcTokenAdapter implements IHypTokenAdapter {
  constructor(
    public readonly chainName: ChainName,
    public readonly multiProvider: MultiProtocolProvider,
    public readonly addresses: {
      intermediateRouterAddress: Address;
      destinationRouterAddress: Address;
    },
    public readonly properties: CosmIbcTokenAdapter['properties'] & {
      derivedIbcDenom: string;
      intermediateChainName: ChainName;
    },
  ) {
    super(chainName, multiProvider, addresses, properties);
  }

  async populateTransferRemoteTx(
    transferParams: TransferRemoteParams,
  ): Promise<MsgTransferEncodeObject> {
    const cwAdapter = new CwHypCollateralAdapter(
      this.properties.intermediateChainName,
      this.multiProvider,
      {
        token: this.properties.derivedIbcDenom,
        warpRouter: this.addresses.intermediateRouterAddress,
      },
      this.properties.ibcDenom,
    );
    const transfer = await cwAdapter.populateTransferRemoteTx(transferParams);
    const cwMemo = {
      wasm: {
        contract: transfer.contractAddress,
        msg: transfer.msg,
        funds: transfer.funds,
      },
    };
    const memo = JSON.stringify(cwMemo);
    return super.populateTransferRemoteTx(
      { ...transferParams, recipient: this.addresses.intermediateRouterAddress },
      memo,
    );
  }
}
