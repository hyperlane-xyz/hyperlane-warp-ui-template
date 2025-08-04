import { MultiProtocolProvider, Token, WarpCore, WarpCoreOptions } from '@hyperlane-xyz/sdk';

interface MultiCollateralToken extends Token {
  token: Token[];
}

export class MultiCollateralWarpCore extends WarpCore {
  public declare readonly tokens: Array<MultiCollateralToken | Token>;

  constructor(
    multiProvider: MultiProtocolProvider<{ mailbox?: Address }>,
    tokens: Array<MultiCollateralToken | Token>,
    options?: WarpCoreOptions,
  ) {
    super(multiProvider, tokens, options);
    this.tokens = tokens;
  }

  static FromWarpCore(warpCore: WarpCore): MultiCollateralWarpCore {
    // TODO: do the token grouping logic

    return new MultiCollateralWarpCore(warpCore.multiProvider, warpCore.tokens, {
      interchainFeeConstants: warpCore.interchainFeeConstants,
      localFeeConstants: warpCore.localFeeConstants,
      routeBlacklist: warpCore.routeBlacklist,
      logger: warpCore.logger,
    });
  }
}
