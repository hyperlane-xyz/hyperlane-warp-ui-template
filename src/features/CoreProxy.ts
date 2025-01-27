import {
  ChainNameOrId,
  IntentCore,
  IToken,
  MultiProtocolProvider,
  parseTokenConnectionId,
  Token,
  TokenAmount,
  WarpCore,
  WarpCoreConfigSchema,
  WarpCoreOptions,
  WarpTypedTransaction,
} from '@hyperlane-xyz/sdk';
import { WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk/dist/warp/types';
import { assert, HexString } from '@hyperlane-xyz/utils';
import { isIntentStandard } from '../utils/intents';

export class CoreProxy {
  private readonly warpCore: WarpCore;
  private readonly intentCore: IntentCore;

  constructor(
    multiProvider: MultiProtocolProvider<{ mailbox?: Address }>,
    tokens: Token[],
    options?: WarpCoreOptions,
  ) {
    this.warpCore = new WarpCore(
      multiProvider,
      tokens.filter(({ standard }) => !isIntentStandard(standard)),
      options,
    );
    this.intentCore = new IntentCore(
      multiProvider,
      tokens.filter(({ standard }) => isIntentStandard(standard)),
      options,
    );
  }

  /**
   * Takes the serialized representation of an intent config and returns a CoreProxy instance
   * @param multiProvider the MultiProtocolProvider containing chain metadata
   * @param config the config object of type IntentCoreConfig
   */
  static FromConfig(
    multiProvider: MultiProtocolProvider<{ mailbox?: Address }>,
    config: unknown,
  ): CoreProxy {
    // Validate and parse config data
    const parsedConfig = WarpCoreConfigSchema.parse(config);
    // Instantiate all tokens
    const tokens = parsedConfig.tokens.map(
      (t) =>
        new Token({
          ...t,
          addressOrDenom: t.addressOrDenom || '',
          intentRouterAddressOrDenom: isIntentStandard(t.standard)
            ? t.intentRouterAddressOrDenom
            : undefined,
          connections: undefined,
        }),
    );
    // Connect tokens together
    parsedConfig.tokens.forEach((config, i) => {
      for (const connection of config.connections || []) {
        const token1 = tokens[i];
        const { chainName, addressOrDenom } = parseTokenConnectionId(connection.token);
        const token2 = tokens.find(
          (t) => t.chainName === chainName && t.addressOrDenom === addressOrDenom,
        );
        assert(token2, `Connected token not found: ${chainName} ${addressOrDenom}`);
        token1.addConnection({
          ...connection,
          token: token2,
        });
      }
    });
    // Create new Intent
    return new CoreProxy(multiProvider, tokens, parsedConfig.options);
  }

  async getTransferRemoteTxs({
    originTokenAmount,
    destination,
    sender,
    recipient,
    interchainFee,
  }: {
    originTokenAmount: TokenAmount;
    destination: ChainNameOrId;
    sender: Address;
    recipient: Address;
    interchainFee?: TokenAmount;
  }): Promise<Array<WarpTypedTransaction>> {
    if (isIntentStandard(originTokenAmount.token.standard)) {
      return this.intentCore.getTransferRemoteTxs({
        originTokenAmount,
        destination,
        sender,
        recipient,
        interchainFee,
      });
    } else {
      return this.warpCore.getTransferRemoteTxs({
        originTokenAmount,
        destination,
        sender,
        recipient,
        interchainFee,
      });
    }
  }

  async estimateTransferRemoteFees({
    originToken,
    destination,
    sender,
    senderPubKey,
  }: {
    originToken: IToken;
    destination: ChainNameOrId;
    sender: Address;
    senderPubKey?: HexString;
  }): Promise<WarpCoreFeeEstimate> {
    if (isIntentStandard(originToken.standard)) {
      return this.intentCore.estimateTransferRemoteFees({
        originToken,
        destination,
        sender,
        senderPubKey,
      });
    } else {
      return this.warpCore.estimateTransferRemoteFees({
        originToken,
        destination,
        sender,
        senderPubKey,
      });
    }
  }

  async getMaxTransferAmount({
    balance,
    destination,
    sender,
    senderPubKey,
    feeEstimate,
  }: {
    balance: TokenAmount;
    destination: ChainNameOrId;
    sender: Address;
    senderPubKey?: HexString;
    feeEstimate?: WarpCoreFeeEstimate;
  }): Promise<TokenAmount> {
    if (isIntentStandard(balance.token.standard)) {
      return this.intentCore.getMaxTransferAmount({
        balance,
        destination,
        sender,
        senderPubKey,
        feeEstimate,
      });
    } else {
      return this.warpCore.getMaxTransferAmount({
        balance,
        destination,
        sender,
        senderPubKey,
        feeEstimate,
      });
    }
  }

  async isDestinationCollateralSufficient({
    originTokenAmount,
    destination,
  }: {
    originTokenAmount: TokenAmount;
    destination: ChainNameOrId;
  }): Promise<boolean> {
    if (isIntentStandard(originTokenAmount.token.standard)) {
      return this.intentCore.isDestinationCollateralSufficient({
        originTokenAmount,
        destination,
      });
    } else {
      return this.warpCore.isDestinationCollateralSufficient({
        originTokenAmount,
        destination,
      });
    }
  }

  async isApproveRequired({
    originTokenAmount,
    owner,
  }: {
    originTokenAmount: TokenAmount;
    owner: Address;
  }): Promise<boolean> {
    if (isIntentStandard(originTokenAmount.token.standard)) {
      return this.intentCore.isApproveRequired({ originTokenAmount, owner });
    } else {
      return this.warpCore.isApproveRequired({ originTokenAmount, owner });
    }
  }

  async validateTransfer({
    originTokenAmount,
    destination,
    recipient,
    sender,
    senderPubKey,
    fillDeadline,
  }: {
    originTokenAmount: TokenAmount;
    destination: ChainNameOrId;
    recipient: Address;
    sender: Address;
    senderPubKey?: HexString;
    fillDeadline?: number;
  }): Promise<Record<string, string> | null> {
    if (isIntentStandard(originTokenAmount.token.standard)) {
      return this.intentCore.validateTransfer({
        originTokenAmount,
        destination,
        recipient,
        sender,
        senderPubKey,
        fillDeadline,
      });
    } else {
      return this.warpCore.validateTransfer({
        originTokenAmount,
        destination,
        recipient,
        sender,
        senderPubKey,
      });
    }
  }

  findToken(chainName: ChainName, addressOrDenom?: Address | string): Token | null {
    return (
      this.warpCore.findToken(chainName, addressOrDenom) ??
      this.intentCore.findToken(chainName, addressOrDenom)
    );
  }

  getTokenChains(): ChainName[] {
    return [...new Set(...this.warpCore.getTokenChains(), ...this.intentCore.getTokenChains())];
  }

  getTokensForChain(chainName: ChainName): Token[] {
    return [
      ...this.warpCore.getTokensForChain(chainName),
      ...this.intentCore.getTokensForChain(chainName),
    ];
  }

  getTokensForRoute(origin: ChainName, destination: ChainName): Token[] {
    return [
      ...this.warpCore.getTokensForRoute(origin, destination),
      ...this.intentCore.getTokensForRoute(origin, destination),
    ];
  }

  get tokens(): Token[] {
    return [...this.warpCore.tokens, ...this.intentCore.tokens];
  }

  get multiProvider(): MultiProtocolProvider {
    return this.warpCore.multiProvider;
  }
}
