import debug, { Debugger } from 'debug';

import { ERC20__factory, ERC721__factory } from '@hyperlane-xyz/core';
import { ChainName, MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { ProtocolType, eqAddress, isValidAddress } from '@hyperlane-xyz/utils';

import { Token } from './Token';
import { TokenAmount } from './TokenAmount';
import { HyperlaneChainId, IgpQuoteConstants, RouteBlacklist, TokenStandard } from './types';

export interface WarpCoreOptions {
  loggerName?: string;
  igpQuoteConstants?: IgpQuoteConstants;
  routeBlacklist?: RouteBlacklist;
}

export class WarpCore {
  public readonly multiProvider: MultiProtocolProvider<{ mailbox?: Address }>;
  public readonly tokens: Token[];
  public readonly igpQuoteConstants: IgpQuoteConstants;
  public readonly routeBlacklist: RouteBlacklist;
  public readonly logger: Debugger;

  constructor(
    multiProvider: MultiProtocolProvider<{ mailbox?: Address }>,
    tokens: Token[],
    options: WarpCoreOptions,
  ) {
    this.multiProvider = multiProvider;
    this.tokens = tokens;
    this.igpQuoteConstants = options?.igpQuoteConstants || [];
    this.routeBlacklist = options?.routeBlacklist || [];
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
    const destinationName = this.multiProvider.getChainName(destination);

    // Step 1: Determine the amount

    let gasAmount: bigint;
    // Check constant quotes first
    const defaultQuote = this.igpQuoteConstants.find(
      (q) => q.origin === originName && q.destination === destinationName,
    );
    if (defaultQuote) {
      gasAmount = BigInt(defaultQuote.toString());
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

    this.logger(`Quoted igp gas payment: ${gasAmount} ${igpToken.symbol}`);
    return new TokenAmount(gasAmount, igpToken);
  }

  async getTransferRemoteTxs(
    originTokenAmount: TokenAmount,
    destination: HyperlaneChainId,
    sender: Address,
    recipient: Address,
  ): Promise<{ approveTx; transferTx }> {
    const { token, amount } = originTokenAmount;
    const destinationDomainId = this.multiProvider.getDomainId(destination);
    const hypAdapter = token.getHypAdapter(this.multiProvider);

    let approveTx: any = undefined;
    if (await this.isApproveRequired(originTokenAmount, sender)) {
      this.logger(`Approval required for transfer of ${token.symbol}`);
      approveTx = await hypAdapter.populateApproveTx({
        weiAmountOrId: amount.toString(),
        recipient: token.addressOrDenom,
      });
    }

    const igpQuote = await this.getTransferGasQuote(token, destination);

    // If sending native tokens (e.g. Eth), the gasPayment must be added to the tx value and sent together
    // TODO decide how to handle txValue here
    // const txValue =
    // (token.equals(igpQuote.token) || token.collateralizes(igpQuote.token))
    //     ? BigNumber(igpQuote.weiAmount).plus(weiAmountOrId).toFixed(0)
    //     : igpQuote.weiAmount;

    const transferTx = await hypAdapter.populateTransferRemoteTx({
      weiAmountOrId: amount.toString(),
      destination: destinationDomainId,
      recipient,
      // TODO
      txValue: igpQuote.amount.toString(),
    });

    return { approveTx, transferTx };
  }

  /**
   * Checks if destination chain's collateral is sufficient to cover the transfer
   */
  async isDestinationCollateralSufficient(
    originTokenAmount: TokenAmount,
    destination: HyperlaneChainId,
  ): Promise<boolean> {
    throw new Error('TODO');
  }

  /**
   * Checks if a token transfer requires an approval tx first
   */
  async isApproveRequired(originTokenAmount: TokenAmount, sender: Address) {
    const { token, amount } = originTokenAmount;
    const tokenAddress = token.addressOrDenom;
    if (token.standard !== TokenStandard.EvmHypCollateral) {
      return false;
    }

    const provider = this.multiProvider.getEthersV5Provider(token.chainName);
    let isRequired: boolean;
    if (token.isNft()) {
      const contract = ERC721__factory.connect(tokenAddress, provider);
      const approvedAddress = await contract.getApproved(amount);
      isRequired = !eqAddress(approvedAddress, tokenAddress);
    } else {
      const contract = ERC20__factory.connect(tokenAddress, provider);
      const allowance = await contract.allowance(sender, tokenAddress);
      isRequired = allowance.lt(amount);
    }
    this.logger(`Approval is${isRequired ? '' : ' not'} required for transfer of ${token.symbol}`);
    return isRequired;
  }

  /**
   * Ensure the remote token transfer would be valid for the given chains, amount, sender, and recipient
   */
  async validateTransfer(
    originTokenAmount: TokenAmount,
    destination: HyperlaneChainId,
    sender: Address,
    recipient: Address,
  ): Promise<Record<string, string> | null> {
    const chainError = this.validateChains(originTokenAmount.token.chainName, destination);
    if (chainError) return chainError;

    const recipientError = this.validateRecipient(recipient, destination);
    if (recipientError) return recipientError;

    const amountError = this.validateAmount(originTokenAmount);
    if (amountError) return amountError;

    const balancesError = await this.validateTokenBalances(originTokenAmount, destination, sender);
    if (balancesError) return balancesError;

    return null;
  }

  /**
   * Ensure the origin and destination chains are valid and known by this WarpCore
   */
  protected validateChains(
    origin: HyperlaneChainId,
    destination: HyperlaneChainId,
  ): Record<string, string> | null {
    if (!origin) return { origin: 'Origin chain required' };
    if (!destination) return { destination: 'Destination chain required' };
    const originMetadata = this.multiProvider.tryGetChainMetadata(origin);
    const destinationMetadata = this.multiProvider.tryGetChainMetadata(destination);
    if (!originMetadata) return { origin: 'Origin chain metadata missing' };
    if (!destinationMetadata) return { destination: 'Destination chain metadata missing' };
    if (
      this.routeBlacklist.some(
        (bl) => bl.origin === originMetadata?.name && bl.destination === destinationMetadata.name,
      )
    ) {
      return { destination: 'Route is not currently allowed' };
    }
    return null;
  }

  /**
   * Ensure recipient address is valid for the destination chain
   */
  protected validateRecipient(
    recipient: Address,
    destination: HyperlaneChainId,
  ): Record<string, string> | null {
    const destinationMetadata = this.multiProvider.getChainMetadata(destination);
    // Ensure recip address is valid for the destination chain's protocol
    if (!isValidAddress(recipient, destinationMetadata.protocol))
      return { recipient: 'Invalid recipient' };
    // Also ensure the address denom is correct if the dest protocol is Cosmos
    if (destinationMetadata.protocol === ProtocolType.Cosmos) {
      if (!destinationMetadata.bech32Prefix) {
        this.logger(`No bech32 prefix found for chain ${destination}`);
        return { destination: 'Invalid chain data' };
      } else if (!recipient.startsWith(destinationMetadata.bech32Prefix)) {
        this.logger(`Recipient address prefix should be ${destination}`);
        return { recipient: `Invalid recipient prefix` };
      }
    }
    return null;
  }

  /**
   * Ensure token amount is valid
   */
  protected validateAmount(originTokenAmount: TokenAmount): Record<string, string> | null {
    if (!originTokenAmount.amount || originTokenAmount.amount < 0n) {
      const isNft = originTokenAmount.token.isNft();
      return { amount: isNft ? 'Invalid Token Id' : 'Invalid amount' };
    }
    return null;
  }

  /**
   * Ensure the sender has sufficient balances for transfer and interchain gas
   */
  protected async validateTokenBalances(
    originTokenAmount: TokenAmount,
    destination: HyperlaneChainId,
    sender: Address,
  ): Promise<Record<string, string> | null> {
    const { token, amount } = originTokenAmount;
    const { amount: senderBalance } = await token.getBalance(this.multiProvider, sender);

    // First check basic token balance
    if (amount > senderBalance) return { amount: 'Insufficient balance' };

    // Next, ensure balances can cover IGP fees
    const igpQuote = await this.getTransferGasQuote(token, destination);
    if (token.equals(igpQuote.token) || token.collateralizes(igpQuote.token)) {
      const total = amount + igpQuote.amount;
      if (senderBalance < total) return { amount: 'Insufficient balance for gas and transfer' };
    } else {
      const igpTokenBalance = await igpQuote.token.getBalance(this.multiProvider, sender);
      if (igpTokenBalance.amount < igpQuote.amount)
        return { amount: `Insufficient ${igpQuote.token.symbol} for gas` };
    }

    return null;
  }

  /**
   * Search through token list to find token with matching chain and address
   */
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
