import {
  ChainNameOrId,
  EvmHypXERC20LockboxAdapter,
  FeeConstantConfig,
  IHypXERC20Adapter,
  IToken,
  MINT_LIMITED_STANDARDS,
  MultiProtocolProvider,
  parseTokenConnectionId,
  RouteBlacklist,
  Token,
  TOKEN_COLLATERALIZED_STANDARDS,
  TOKEN_STANDARD_TO_PROVIDER_TYPE,
  TokenAmount,
  TokenStandard,
  WarpCoreConfigSchema,
  WarpTxCategory,
  WarpTypedTransaction,
} from '@hyperlane-xyz/sdk';
import {
  Address,
  assert,
  convertDecimalsToIntegerString,
  convertToProtocolAddress,
  hexOrBase58ToHex,
  HexString,
  isValidAddress,
  isZeroishAddress,
  ProtocolType,
} from '@hyperlane-xyz/utils';
import { Logger } from 'pino';

export interface WarpCoreOptions {
  logger?: Logger;
  localFeeConstants?: FeeConstantConfig;
  interchainFeeConstants?: FeeConstantConfig;
  routeBlacklist?: RouteBlacklist;
}

export interface WarpCoreFeeEstimate {
  interchainQuote: TokenAmount;
  localQuote: TokenAmount;
}

export interface TransactionFeeEstimate {
  gasUnits: number | bigint;
  gasPrice: number | bigint;
  fee: number | bigint;
}

export class WarpCore {
  public readonly multiProvider: MultiProtocolProvider<{ mailbox?: Address }>;
  public readonly tokens: Token[];
  public readonly localFeeConstants: FeeConstantConfig;
  public readonly interchainFeeConstants: FeeConstantConfig;
  public readonly routeBlacklist: RouteBlacklist;
  constructor(
    multiProvider: MultiProtocolProvider<{ mailbox?: Address }>,
    tokens: Token[],
    options?: WarpCoreOptions,
  ) {
    this.multiProvider = multiProvider;
    this.tokens = tokens;
    this.localFeeConstants = options?.localFeeConstants || [];
    this.interchainFeeConstants = options?.interchainFeeConstants || [];
    this.routeBlacklist = options?.routeBlacklist || [];
  }

  /**
   * Takes the serialized representation of a warp config and returns a WarpCore instance
   * @param multiProvider the MultiProtocolProvider containing chain metadata
   * @param config the config object of type WarpCoreConfig
   */
  static FromConfig(
    multiProvider: MultiProtocolProvider<{ mailbox?: Address }>,
    config: unknown,
  ): WarpCore {
    // Validate and parse config data
    const parsedConfig = WarpCoreConfigSchema.parse(config);
    // Instantiate all tokens
    const tokens = parsedConfig.tokens.map(
      (t) =>
        new Token({
          ...t,
          addressOrDenom: t.addressOrDenom || '',
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
    // Create new Warp
    return new WarpCore(multiProvider, tokens, parsedConfig.options);
  }

  /**
   * Queries the token router for an interchain gas quote (i.e. IGP fee).
   * Sender is only required for Sealevel origins.
   */
  async getInterchainTransferFee({
    originToken,
    destination,
    sender,
  }: {
    originToken: IToken;
    destination: ChainNameOrId;
    sender?: Address;
  }): Promise<TokenAmount> {
    console.log(`Fetching interchain transfer quote to ${destination}`);
    const { chainName: originName } = originToken;
    const destinationName = this.multiProvider.getChainName(destination);

    let gasAmount: bigint;
    let gasAddressOrDenom: string | undefined;
    // Check constant quotes first
    const defaultQuote = this.interchainFeeConstants.find(
      (q) => q.origin === originName && q.destination === destinationName,
    );
    if (defaultQuote) {
      gasAmount = BigInt(defaultQuote.amount.toString());
      gasAddressOrDenom = defaultQuote.addressOrDenom;
    } else {
      // Otherwise, compute IGP quote via the adapter
      const hypAdapter = originToken.getHypAdapter(this.multiProvider, destinationName);
      const destinationDomainId = this.multiProvider.getDomainId(destination);
      const quote = await hypAdapter.quoteTransferRemoteGas(destinationDomainId, sender);
      gasAmount = BigInt(quote.amount);
      gasAddressOrDenom = quote.addressOrDenom;
    }

    let igpToken: Token;
    if (!gasAddressOrDenom) {
      // An empty/undefined addressOrDenom indicates the native token
      igpToken = Token.FromChainMetadataNativeToken(
        this.multiProvider.getChainMetadata(originName),
      );
    } else {
      const searchResult = this.findToken(originName, gasAddressOrDenom);
      assert(searchResult, `Fee token ${gasAddressOrDenom} is unknown`);
      igpToken = searchResult;
    }

    console.log(`Quoted interchain transfer fee: ${gasAmount} ${igpToken.symbol}`);
    return new TokenAmount(gasAmount, igpToken);
  }

  /**
   * Simulates a transfer to estimate 'local' gas fees on the origin chain
   */
  async getLocalTransferFee({
    originToken,
    destination,
    sender,
    recipient,
    senderPubKey,
    interchainFee,
  }: {
    originToken: IToken;
    destination: ChainNameOrId;
    sender: Address;
    recipient?: Address;
    senderPubKey?: HexString;
    interchainFee?: TokenAmount;
  }): Promise<TransactionFeeEstimate> {
    console.log(`Estimating local transfer gas to ${destination}`);
    const originMetadata = this.multiProvider.getChainMetadata(originToken.chainName);
    const destinationMetadata = this.multiProvider.getChainMetadata(destination);

    // Check constant quotes first
    const defaultQuote = this.localFeeConstants.find(
      (q) => q.origin === originMetadata.name && q.destination === destinationMetadata.name,
    );
    if (defaultQuote) {
      return { gasUnits: 0, gasPrice: 0, fee: Number(defaultQuote.amount) };
    }

    // TODO: DOES NOT WORK FOR STARKNET
    // Form transactions to estimate local gas with
    const recipientAddress = convertToProtocolAddress(
      recipient ?? sender, // TODO: get recipient instead of sender
      destinationMetadata.protocol,
      destinationMetadata.bech32Prefix,
    );
    const txs = await this.getTransferRemoteTxs({
      originTokenAmount: originToken.amount(1),
      destination,
      sender,
      recipient: recipientAddress,
      interchainFee,
    });

    // Typically the transfers require a single transaction
    if (txs.length === 1) {
      try {
        return this.multiProvider.estimateTransactionFee({
          chainNameOrId: originMetadata.name,
          transaction: txs[0],
          sender,
          senderPubKey,
        });
      } catch (error) {
        console.log(`Failed to estimate local gas fee for ${originToken.symbol} transfer`, error);
        throw new Error('Gas estimation failed, balance may be insufficient', {
          cause: error,
        });
      }
    }
    // On ethereum, sometimes 2 txs are required (one approve, one transferRemote)
    else if (txs.length === 2 && originToken.protocol === ProtocolType.Ethereum) {
      // const provider = this.multiProvider.getEthersV5Provider(originMetadata.name);
      // We use a hard-coded const as an estimate for the transferRemote because we
      // cannot reliably simulate the tx when an approval tx is required first
      return { gasUnits: 1, gasPrice: 1, fee: 1 };
    } else if (txs.length === 2 && originToken.protocol === ProtocolType.Starknet) {
      console.log(`Skipping gas estimation for Starknet`);
      return { gasUnits: 0, gasPrice: 0, fee: 0 };
    } else {
      throw new Error('Cannot estimate local gas for multiple transactions');
    }
  }

  /**
   * Similar to getLocalTransferFee in that it estimates local gas fees
   * but it also resolves the native token and returns a TokenAmount
   * @todo: rename to getLocalTransferFee for consistency (requires breaking change)
   */
  async getLocalTransferFeeAmount({
    originToken,
    destination,
    sender,
    recipient,
    senderPubKey,
    interchainFee,
  }: {
    originToken: IToken;
    destination: ChainNameOrId;
    sender: Address;
    recipient?: Address;
    senderPubKey?: HexString;
    interchainFee?: TokenAmount;
  }): Promise<TokenAmount> {
    const originMetadata = this.multiProvider.getChainMetadata(originToken.chainName);
    // If there's no native token, we can't represent local gas
    if (!originMetadata.nativeToken)
      throw new Error(`No native token found for ${originMetadata.name}`);

    console.log(`Using native token ${originMetadata.nativeToken.symbol} for local gas fee`);

    const localFee = await this.getLocalTransferFee({
      originToken,
      destination,
      sender,
      recipient,
      senderPubKey,
      interchainFee,
    });

    // Get the local gas token. This assumes the chain's native token will pay for local gas
    // This will need to be smarter if more complex scenarios on Cosmos are supported
    const localGasToken = Token.FromChainMetadataNativeToken(originMetadata);
    return localGasToken.amount(localFee.fee);
  }

  /**
   * Gets a list of populated transactions required to transfer a token to a remote chain
   * Typically just 1 transaction but sometimes more, like when an approval is required first
   */
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
    const transactions: Array<WarpTypedTransaction> = [];

    const { token, amount } = originTokenAmount;
    const destinationName = this.multiProvider.getChainName(destination);
    const destinationDomainId = this.multiProvider.getDomainId(destination);
    const providerType = TOKEN_STANDARD_TO_PROVIDER_TYPE[token.standard];
    const hypAdapter = token.getHypAdapter(this.multiProvider, destinationName);

    if (await this.isApproveRequired({ originTokenAmount, owner: sender })) {
      console.log(`Approval required for transfer of ${token.symbol}`);
      const approveTxReq = await hypAdapter.populateApproveTx({
        weiAmountOrId: amount.toString(),
        recipient: token.addressOrDenom,
      });
      console.log(`Approval tx for ${token.symbol} populated`);

      const approveTx = {
        category: WarpTxCategory.Approval,
        type: providerType,
        transaction: approveTxReq,
      } as WarpTypedTransaction;
      transactions.push(approveTx);
    }

    if (!interchainFee) {
      interchainFee = await this.getInterchainTransferFee({
        originToken: token,
        destination,
        sender,
      });
    }

    const transferTxReq = await hypAdapter.populateTransferRemoteTx({
      weiAmountOrId: amount.toString(),
      destination: destinationDomainId,
      fromAccountOwner: sender,
      recipient: hexOrBase58ToHex(recipient),
      interchainGas: {
        amount: interchainFee.amount,
        addressOrDenom: interchainFee.token.addressOrDenom,
      },
    });
    console.log(`Remote transfer tx for ${token.symbol} populated`);

    const transferTx = {
      category: WarpTxCategory.Transfer,
      type: providerType,
      transaction: transferTxReq,
    } as WarpTypedTransaction;
    transactions.push(transferTx);

    return transactions;
  }

  /**
   * Fetch local and interchain fee estimates for a remote transfer
   */
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
    console.log('Fetching remote transfer fee estimates');

    // First get interchain gas quote (aka IGP quote)
    // Start with this because it's used in the local fee estimation
    const interchainQuote = await this.getInterchainTransferFee({
      originToken,
      destination,
      sender,
    });

    // Next, get the local gas quote
    const localQuote = await this.getLocalTransferFeeAmount({
      originToken,
      destination,
      sender,
      senderPubKey,
      interchainFee: interchainQuote,
    });

    return {
      interchainQuote,
      localQuote,
    };
  }

  /**
   * Computes the max transferrable amount of the from the given
   * token balance, accounting for local and interchain gas fees
   */
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
    const originToken = balance.token;

    if (!feeEstimate) {
      feeEstimate = await this.estimateTransferRemoteFees({
        originToken,
        destination,
        sender,
        senderPubKey,
      });
    }
    const { localQuote, interchainQuote } = feeEstimate;

    let maxAmount = balance;
    if (originToken.isFungibleWith(localQuote.token)) {
      maxAmount = maxAmount.minus(localQuote.amount);
    }

    if (originToken.isFungibleWith(interchainQuote.token)) {
      maxAmount = maxAmount.minus(interchainQuote.amount);
    }

    if (maxAmount.amount > 0) return maxAmount;
    else return originToken.amount(0);
  }

  /**
   * Checks if destination chain's collateral is sufficient to cover the transfer
   */
  async isDestinationCollateralSufficient({
    originTokenAmount,
    destination,
  }: {
    originTokenAmount: TokenAmount;
    destination: ChainNameOrId;
  }): Promise<boolean> {
    const { token: originToken, amount } = originTokenAmount;
    const destinationName = this.multiProvider.getChainName(destination);
    console.log(`Checking collateral for ${originToken.symbol} to ${destination}`);

    const destinationToken = originToken.getConnectionForChain(destinationName)?.token;
    assert(destinationToken, `No connection found for ${destinationName}`);

    if (!TOKEN_COLLATERALIZED_STANDARDS.includes(destinationToken.standard)) {
      console.log(`${destinationToken.symbol} is not collateralized, skipping`);
      return true;
    }

    let destinationBalance: bigint = 0n;

    if (
      destinationToken.standard === TokenStandard.EvmHypXERC20Lockbox ||
      destinationToken.standard === TokenStandard.EvmHypVSXERC20Lockbox
    ) {
      const adapter = destinationToken.getAdapter(this.multiProvider) as EvmHypXERC20LockboxAdapter;
      destinationBalance = await adapter.getBridgedSupply();
    } else {
      const adapter = destinationToken.getAdapter(this.multiProvider);
      destinationBalance = await adapter.getBalance(destinationToken.addressOrDenom);
    }

    const destinationBalanceInOriginDecimals = convertDecimalsToIntegerString(
      destinationToken.decimals,
      originToken.decimals,
      destinationBalance.toString(),
    );

    const isSufficient = BigInt(destinationBalanceInOriginDecimals) >= amount;
    console.log(
      `${originTokenAmount.token.symbol} to ${destination} has ${
        isSufficient ? 'sufficient' : 'INSUFFICIENT'
      } collateral`,
    );
    return isSufficient;
  }

  /**
   * Checks if a token transfer requires an approval tx first
   */
  async isApproveRequired({
    originTokenAmount,
    owner,
  }: {
    originTokenAmount: TokenAmount;
    owner: Address;
  }): Promise<boolean> {
    const { token, amount } = originTokenAmount;
    const adapter = token.getAdapter(this.multiProvider);
    const isRequired = await adapter.isApproveRequired(owner, token.addressOrDenom, amount);
    console.log(`Approval is${isRequired ? '' : ' not'} required for transfer of ${token.symbol}`);
    return isRequired;
  }

  /**
   * Ensure the remote token transfer would be valid for the given chains, amount, sender, and recipient
   */
  async validateTransfer({
    originTokenAmount,
    destination,
    recipient,
    sender,
    senderPubKey,
  }: {
    originTokenAmount: TokenAmount;
    destination: ChainNameOrId;
    recipient: Address;
    sender: Address;
    senderPubKey?: HexString;
  }): Promise<Record<string, string> | null> {
    const chainError = this.validateChains(originTokenAmount.token.chainName, destination);
    if (chainError) return chainError;
    console.log(
      'validateTransfer',
      originTokenAmount,
      destination,
      recipient,
      sender,
      senderPubKey,
    );

    const recipientError = this.validateRecipient(recipient, destination);
    if (recipientError) return recipientError;

    const amountError = await this.validateAmount(originTokenAmount, destination, recipient);
    if (amountError) return amountError;

    const destinationRateLimitError = await this.validateDestinationRateLimit(
      originTokenAmount,
      destination,
    );
    if (destinationRateLimitError) return destinationRateLimitError;

    const destinationCollateralError = await this.validateDestinationCollateral(
      originTokenAmount,
      destination,
    );
    if (destinationCollateralError) return destinationCollateralError;

    const originCollateralError = await this.validateOriginCollateral(originTokenAmount);
    if (originCollateralError) return originCollateralError;

    const balancesError = await this.validateTokenBalances(
      originTokenAmount,
      destination,
      sender,
      recipient,
      senderPubKey,
    );
    if (balancesError) return balancesError;

    return null;
  }

  /**
   * Ensure the origin and destination chains are valid and known by this WarpCore
   */
  protected validateChains(
    origin: ChainNameOrId,
    destination: ChainNameOrId,
  ): Record<string, string> | null {
    if (!origin) return { origin: 'Origin chain required' };
    if (!destination) return { destination: 'Destination chain required' };
    const originMetadata = this.multiProvider.tryGetChainMetadata(origin);
    const destinationMetadata = this.multiProvider.tryGetChainMetadata(destination);
    if (!originMetadata) return { origin: 'Origin chain metadata missing' };
    if (!destinationMetadata) return { destination: 'Destination chain metadata missing' };
    if (
      this.routeBlacklist.some(
        (bl) => bl.origin === originMetadata.name && bl.destination === destinationMetadata.name,
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
    destination: ChainNameOrId,
  ): Record<string, string> | null {
    const destinationMetadata = this.multiProvider.getChainMetadata(destination);
    const { protocol, bech32Prefix } = destinationMetadata;
    // Ensure recip address is valid for the destination chain's protocol
    if (!isValidAddress(recipient, protocol) || isZeroishAddress(recipient))
      return { recipient: 'Invalid recipient' };

    // Also ensure the address denom is correct if the dest protocol is Cosmos
    if (protocol === ProtocolType.Cosmos) {
      if (!bech32Prefix) {
        console.log(`No bech32 prefix found for chain ${destination}`);
        return { destination: 'Invalid chain data' };
      } else if (!recipient.startsWith(bech32Prefix)) {
        console.log(`Recipient prefix should be ${bech32Prefix}`);
        return { recipient: 'Invalid recipient prefix' };
      }
    }
    return null;
  }

  /**
   * Ensure token amount is valid
   */
  protected async validateAmount(
    originTokenAmount: TokenAmount,
    destination: ChainNameOrId,
    recipient: Address,
  ): Promise<Record<string, string> | null> {
    if (!originTokenAmount.amount || originTokenAmount.amount < 0n) {
      const isNft = originTokenAmount.token.isNft();
      return { amount: isNft ? 'Invalid Token Id' : 'Invalid amount' };
    }

    // Check the transfer amount is sufficient on the destination side

    const originToken = originTokenAmount.token;

    const destinationName = this.multiProvider.getChainName(destination);
    const destinationToken = originToken.getConnectionForChain(destinationName)?.token;
    assert(destinationToken, `No connection found for ${destinationName}`);
    const destinationAdapter = destinationToken.getAdapter(this.multiProvider);

    // Get the min required destination amount
    const minDestinationTransferAmount =
      await destinationAdapter.getMinimumTransferAmount(recipient);

    // Convert the minDestinationTransferAmount to an origin amount
    const minOriginTransferAmount = destinationToken.amount(
      convertDecimalsToIntegerString(
        originToken.decimals,
        destinationToken.decimals,
        minDestinationTransferAmount.toString(),
      ),
    );

    if (minOriginTransferAmount.amount > originTokenAmount.amount) {
      return {
        amount: `Minimum transfer amount is ${minOriginTransferAmount.getDecimalFormattedAmount()} ${
          originToken.symbol
        }`,
      };
    }

    return null;
  }

  /**
   * Ensure the sender has sufficient balances for transfer and interchain gas
   */
  protected async validateTokenBalances(
    originTokenAmount: TokenAmount,
    destination: ChainNameOrId,
    sender: Address,
    recipient: Address,
    senderPubKey?: HexString,
  ): Promise<Record<string, string> | null> {
    const { token: originToken, amount } = originTokenAmount;

    const { amount: senderBalance } = await originToken.getBalance(this.multiProvider, sender);
    const senderBalanceAmount = originTokenAmount.token.amount(senderBalance);

    // Check 1: Check basic token balance
    if (amount > senderBalance) return { amount: 'Insufficient balance' };

    // Check 2: Ensure the balance can cover interchain fee
    // Slightly redundant with Check 4 but gives more specific error messages
    const interchainQuote = await this.getInterchainTransferFee({
      originToken,
      destination,
      sender,
    });
    // Get balance of the IGP fee token, which may be different from the transfer token
    const interchainQuoteTokenBalance = originToken.isFungibleWith(interchainQuote.token)
      ? senderBalanceAmount
      : await interchainQuote.token.getBalance(this.multiProvider, sender);
    if (interchainQuoteTokenBalance.amount < interchainQuote.amount) {
      return {
        amount: `Insufficient ${interchainQuote.token.symbol} for interchain gas`,
      };
    }

    // Check 3: Simulates the transfer by getting the local gas fee
    const localQuote = await this.getLocalTransferFeeAmount({
      originToken,
      destination,
      sender,
      recipient,
      senderPubKey,
      interchainFee: interchainQuote,
    });

    const feeEstimate = { interchainQuote, localQuote };

    // Check 4: Ensure balances can cover the COMBINED amount and fees
    const maxTransfer = await this.getMaxTransferAmount({
      balance: senderBalanceAmount,
      destination,
      sender,
      senderPubKey,
      feeEstimate,
    });
    if (amount > maxTransfer.amount) {
      return { amount: 'Insufficient balance for gas and transfer' };
    }

    return null;
  }

  /**
   * Ensure the sender has sufficient balances for transfer and interchain gas
   */
  protected async validateDestinationCollateral(
    originTokenAmount: TokenAmount,
    destination: ChainNameOrId,
  ): Promise<Record<string, string> | null> {
    const valid = await this.isDestinationCollateralSufficient({
      originTokenAmount,
      destination,
    });

    if (!valid) {
      return { amount: 'Insufficient collateral on destination' };
    }
    return null;
  }

  /**
   * Ensure the sender has sufficient balances for minting
   */
  protected async validateDestinationRateLimit(
    originTokenAmount: TokenAmount,
    destination: ChainNameOrId,
  ): Promise<Record<string, string> | null> {
    const { token: originToken, amount } = originTokenAmount;
    const destinationName = this.multiProvider.getChainName(destination);
    const destinationToken = originToken.getConnectionForChain(destinationName)?.token;
    assert(destinationToken, `No connection found for ${destinationName}`);

    if (!MINT_LIMITED_STANDARDS.includes(destinationToken.standard)) {
      console.log(`${destinationToken.symbol} does not have rate limit constraint, skipping`);
      return null;
    }

    let destinationMintLimit: bigint = 0n;
    if (
      destinationToken.standard === TokenStandard.EvmHypVSXERC20 ||
      destinationToken.standard === TokenStandard.EvmHypVSXERC20Lockbox ||
      destinationToken.standard === TokenStandard.EvmHypXERC20 ||
      destinationToken.standard === TokenStandard.EvmHypXERC20Lockbox
    ) {
      const adapter = destinationToken.getAdapter(this.multiProvider) as IHypXERC20Adapter<unknown>;
      destinationMintLimit = await adapter.getMintLimit();

      if (
        destinationToken.standard === TokenStandard.EvmHypVSXERC20 ||
        destinationToken.standard === TokenStandard.EvmHypVSXERC20Lockbox
      ) {
        const bufferCap = await adapter.getMintMaxLimit();
        const max = bufferCap / 2n;
        if (destinationMintLimit > max) {
          console.log(`Mint limit ${destinationMintLimit} exceeds max ${max}, using max`);
          destinationMintLimit = max;
        }
      }
    }

    const destinationMintLimitInOriginDecimals = convertDecimalsToIntegerString(
      destinationToken.decimals,
      originToken.decimals,
      destinationMintLimit.toString(),
    );

    const isSufficient = BigInt(destinationMintLimitInOriginDecimals) >= amount;
    console.log(
      `${originTokenAmount.token.symbol} to ${destination} has ${
        isSufficient ? 'sufficient' : 'INSUFFICIENT'
      } rate limits`,
    );
    if (!isSufficient) return { amount: 'Rate limit exceeded on destination' };
    return null;
  }

  /**
   * Ensure the sender has sufficient balances for transfer and interchain gas
   */
  protected async validateOriginCollateral(
    originTokenAmount: TokenAmount,
  ): Promise<Record<string, string> | null> {
    const adapter = originTokenAmount.token.getAdapter(this.multiProvider);

    if (
      originTokenAmount.token.standard === TokenStandard.EvmHypXERC20 ||
      originTokenAmount.token.standard === TokenStandard.EvmHypXERC20Lockbox
    ) {
      const burnLimit = await (adapter as IHypXERC20Adapter<unknown>).getBurnLimit();
      if (burnLimit < BigInt(originTokenAmount.amount)) {
        return { amount: 'Insufficient burn limit on origin' };
      }
    }

    return null;
  }

  /**
   * Search through token list to find token with matching chain and address
   */
  findToken(chainName: ChainName, addressOrDenom?: Address | string): Token | null {
    if (!addressOrDenom) return null;

    const results = this.tokens.filter(
      (token) =>
        token.chainName === chainName &&
        token.addressOrDenom.toLowerCase() === addressOrDenom.toLowerCase(),
    );

    if (results.length === 1) return results[0];

    if (results.length > 1) throw new Error(`Ambiguous token search results for ${addressOrDenom}`);

    // If the token is not found, check to see if it matches the denom of chain's native token
    // This is a convenience so WarpConfigs don't need to include definitions for native tokens
    const chainMetadata = this.multiProvider.getChainMetadata(chainName);
    if (chainMetadata.nativeToken?.denom === addressOrDenom) {
      return Token.FromChainMetadataNativeToken(chainMetadata);
    }

    return null;
  }

  /**
   * Get the list of chains referenced by the tokens in this WarpCore
   */
  getTokenChains(): ChainName[] {
    return [...new Set(this.tokens.map((t) => t.chainName)).values()];
  }

  /**
   * Get the subset of tokens whose chain matches the given chainName
   */
  getTokensForChain(chainName: ChainName): Token[] {
    return this.tokens.filter((t) => t.chainName === chainName);
  }

  /**
   * Get the subset of tokens whose chain matches the given chainName
   * and which are connected to a token on the given destination chain
   */
  getTokensForRoute(origin: ChainName, destination: ChainName): Token[] {
    return this.tokens.filter(
      (t) => t.chainName === origin && t.getConnectionForChain(destination),
    );
  }
}
