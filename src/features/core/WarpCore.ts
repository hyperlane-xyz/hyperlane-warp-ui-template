import debug, { Debugger } from 'debug';

import { ChainName, MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { Token } from './Token';
import { TokenAmount } from './TokenAmount';
import { HyperlaneChainId, IgpQuoteConstants } from './types';

export interface WarpCoreOptions {
  loggerName?: string;
  igpQuoteConstants?: IgpQuoteConstants;
}

export class WarpCore {
  public readonly multiProvider: MultiProtocolProvider<{ mailbox?: Address }>;
  public readonly tokens: Token[];
  public readonly igpQuoteConstants: IgpQuoteConstants;
  public readonly logger: Debugger;

  constructor(
    multiProvider: MultiProtocolProvider<{ mailbox?: Address }>,
    tokens: Token[],
    options: WarpCoreOptions,
  ) {
    this.multiProvider = multiProvider;
    this.tokens = tokens;
    this.igpQuoteConstants = options?.igpQuoteConstants || {};
    this.logger = debug(options?.loggerName || 'hyperlane:WarpCore');
  }

  // Takes the serialized representation of a complete warp config and returns a WarpCore instance
  static FromConfig(
    _multiProvider: MultiProtocolProvider<{ mailbox?: Address }>,
    _config: string,
  ): WarpCore {
    throw new Error('TODO: method not implemented');
  }

  async getTransferGasQuote(
    originToken: Token,
    destination: HyperlaneChainId,
  ): Promise<TokenAmount> {
    const { chainName: originName, protocol: originProtocol } = originToken;

    // Step 1: Determine the amount

    let gasAmount: bigint;
    const defaultQuotes = this.igpQuoteConstants[originProtocol];
    // Check constant quotes first
    if (typeof defaultQuotes === 'string') {
      gasAmount = BigInt(defaultQuotes);
    } else if (defaultQuotes?.[originName]) {
      gasAmount = BigInt(defaultQuotes[originName]);
    } else {
      // Otherwise, compute IGP quote via the adapter
      const hypAdapter = originToken.getHypAdapter(this.multiProvider);
      const destinationDomainId = this.multiProvider.getDomainId(destination);
      gasAmount = BigInt(await hypAdapter.quoteGasPayment(destinationDomainId));
    }

    // Step 2: Determine the IGP token
    // TODO, it would be more robust to determine this based on on-chain data
    // rather than these janky heuristic

    // If the token has an explicit IGP token address set, use that
    let igpToken: Token;
    if (originToken.igpTokenAddressOrDenom) {
      const searchResult = this.findToken(originToken.igpTokenAddressOrDenom, originName);
      if (!searchResult)
        throw new Error(`IGP token ${originToken.igpTokenAddressOrDenom} is unknown`);
      igpToken = searchResult;
    } else if (originProtocol === ProtocolType.Cosmos) {
      // If the protocol is cosmos, assume the token itself is used
      igpToken = originToken;
    } else {
      // Otherwise use the plain old native token from the route origin
      igpToken = Token.FromChainMetadataNativeToken(
        this.multiProvider.getChainMetadata(originName),
      );
    }

    return new TokenAmount(gasAmount, igpToken);
  }

  async validateTransfer(
    originTokenAmount: TokenAmount,
    destination: HyperlaneChainId,
    recipient: Address,
  ): Promise<Record<string, string> | null> {
    throw new Error('TODO');
  }

  async getTransferRemoteTxs(
    originTokenAmount: TokenAmount,
    destination: HyperlaneChainId,
    recipient: Address,
  ): Promise<{ approveTx; transferTx }> {
    throw new Error('TODO');
  }

  // Checks to ensure the destination chain's collateral is sufficient to cover the transfer
  async isDestinationCollateralSufficient(
    originTokenAmount: TokenAmount,
    destination: HyperlaneChainId,
  ): Promise<boolean> {
    throw new Error('TODO');
  }

  findToken(addressOrDenom: Address | string, chainName: ChainName): Token | null {
    const results = this.tokens.filter(
      (token) =>
        token.chainName === chainName &&
        token.addressOrDenom.toLowerCase() === addressOrDenom.toLowerCase(),
    );
    if (!results.length) return null;
    if (results.length > 1) throw new Error(`Ambiguous token search results for ${addressOrDenom}`);
    return results[0];
  }
}
