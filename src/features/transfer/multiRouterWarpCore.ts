import { WarpCore } from '@hyperlane-xyz/sdk';

type WithDestinationTokenAddress<T> = T & { destinationTokenAddress?: string };

export interface MultiRouterWarpCore extends WarpCore {
  getInterchainTransferFee: (
    params: WithDestinationTokenAddress<Parameters<WarpCore['getInterchainTransferFee']>[0]>,
  ) => ReturnType<WarpCore['getInterchainTransferFee']>;
  getTransferRemoteTxs: (
    params: WithDestinationTokenAddress<Parameters<WarpCore['getTransferRemoteTxs']>[0]>,
  ) => ReturnType<WarpCore['getTransferRemoteTxs']>;
  estimateTransferRemoteFees: (
    params: WithDestinationTokenAddress<Parameters<WarpCore['estimateTransferRemoteFees']>[0]>,
  ) => ReturnType<WarpCore['estimateTransferRemoteFees']>;
  getMaxTransferAmount: (
    params: WithDestinationTokenAddress<Parameters<WarpCore['getMaxTransferAmount']>[0]>,
  ) => ReturnType<WarpCore['getMaxTransferAmount']>;
  isDestinationCollateralSufficient: (
    params: WithDestinationTokenAddress<
      Parameters<WarpCore['isDestinationCollateralSufficient']>[0]
    >,
  ) => ReturnType<WarpCore['isDestinationCollateralSufficient']>;
  validateTransfer: (
    params: WithDestinationTokenAddress<Parameters<WarpCore['validateTransfer']>[0]>,
  ) => ReturnType<WarpCore['validateTransfer']>;
}

export function asMultiRouterWarpCore(warpCore: WarpCore): MultiRouterWarpCore {
  return warpCore as unknown as MultiRouterWarpCore;
}
