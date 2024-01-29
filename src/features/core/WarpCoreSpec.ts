
type HyperlaneChainId = ChainName | ChainId | DomainId;

export enum TokenStandard {
  // EVM
  ERC20,
  ERC721,
  EvmNative,
  EvmHypNative,
  EvmHypCollateral,
  EvmHypSynthetic,

  // Sealevel (Solana)
  SealevelSpl,
  SealevelSpl2022,
  SealevelNative,
  SealevelHypNative,
  SealevelHypCollateral,
  SealevelHypSynthetic,

  // Cosmos
  CosmosIcs20,
  CosmosIcs721,
  CosmosNative,
  CosmosIbc,
  CosmosFactory,

  // CosmWasm
  CW20,
  CW721,
  CwHypNative,
  CwHypCollateral,
  CwHypSynthetic,
}

export class Token {
  constructor({ protocol, chainName, standard, addressOrDenom, collateralizedAddressOrDenom, symbol, decimals, name, logoUri }) {}

  getAdapter(multiProvider): ITokenAdapter 
  getHypAdapter(multiProvider): IHypTokenAdapter  // throws if not supported by standard

  isNft(): boolean 

  amount(amountWei): TokenAmount
}

export class TokenAmount {
  constructor({ amountWei, token })
  getWei(): bigint 
  getUnits(): number
  plus(amountWei): TokenAmount 
  minus(amountWei): TokenAmount 
}

export class TokenManager() {
  constructor({ multiProvider, tokens })
  getToken(chain: HyperlaneChainId, addressOrDenom): Token
  getTokensByAddress(addressOrDenom): Token[] 
}

export class WarpRoute {
  constructor({ originChainName, originToken, destinationChainName, destinationToken })

  getOriginAdapter(): ITokenAdapter 
  getDestinationAdapter(): ITokenAdapter 

  getOriginHypAdapter(): IHypTokenAdapter 
  getDestinationHypAdapter(): IHypTokenAdapter 

  getOriginProtocol(): ProtocolType 
  getDestinationProtocol(): ProtocolType
}

export class WarpRouteManager {
  constructor({ multiProvider, routes }) 

  getRoutesFrom(origin: HyperlaneChainId): WarpRoute[]
  getRoutesTo(destination: HyperlaneChainId): WarpRoute[] 

  getRoute(origin, destination, originToken, destinationToken): WarpRoute
  hasRoute(origin, destination, originToken, destinationToken): boolean 
}

export class WarpCore {
  constructor({
    // Note, there's no ChainManager here because MultiProvider extends ChainMetadataManager and serves that function
    multiProvider: MultiProtocolProvider<{ mailbox?: Address }>,
    tokens: ITokenManager,
    routes: IRouteManager,
  }) 

  // Takes the serialized representation of a complete warp config and returns a WarpCore instance
  static FromConfig(config:string): WarpCore

  async getOriginBalance(route: Route, accountAddress:Address): TokenAmount
  async getDestinationBalance(route: Route, accountAddress:Address): TokenAmount

  async getTransferGasQuote(route: Route, tokenAmount: TokenAmount): Promise<TokenAmount>  
  
  async validateTransfer(route: Route, tokenAmount: TokenAmount, 
    recipient:Address): Promise<Record<string,string> | null>

  async getTransferRemoteTxs(route: Route, tokenAmount: TokenAmount,
    recipient:Address): Promise<{approveTx, transferTx}>

  async getMessageId(route: Route, txReceipt): Promise<string> 
  async getTransferStatus(route: Route, messageId: string): Promise<MessageStatus> 

  // Checks to ensure the destination chain's collateral is sufficient to cover the transfer
  async isDestinationCollateralSufficient(
    route: Route,
    tokenAmount: TokenAmount,
  ): Promise<boolean>
}

// Converts the user-provided token, chain, and route configs into a fully 
// specified warp config. It auto-maps routes and fills in missing token data. 
// This keeps the user-facing configs succinct. 
// ALTERNATIVELY: Maybe we should use a single, verbose config layer since configs often
// comes from the CLI anyway. Downside: can't respond easily to router enrollments.
export class WarpConfigBuilder {
  constructor(chainConfig, tokenConfig)
  async build(): WarpConfig 
}

/* 
NOTES BELOW, FEEL FREE TO IGNORE

Improvements:
==============
Improve modularity & testability
Handle IGP business logic in single place
Reduce protocol-specific tx crafting special casing
Make IBC vs Hyp routes substitutable
Kill concept of 'base tokens'
Kill cluster of utils functions for routes & tokens
Kill CAIP IDs and related utils
Improve NFT vs non-NFT substitutability

Non-goals:
==========
Improve wallet hooks + integrations
Improve Warp UI UX

Ideas:
======
Smarter Token class (and a child WarpToken?)
TokenManager
Smart Chain class (and a child WarpChain?)
  -> these help avoid CAIP ids
Smarter Route class
-> replace route utils with methods
Replace routes dictionary with graph
  -> routes are nodes, tokens are edges
ToCAIP method on smart classes
  -> or some other serialization method
GasQuote method
  -> avoid direct-to-adapter igq quoting, as engine instead
  -> copy over logic form current hook
  -> Params: fromChain, toChain, fromToken, toToken, amount
  -> Returns IGP quote and maybe also native gas quote
Maybe a toRoutes() method for backwards compat
Migrate useTokenTransfer logic into engine
Leverage HypCore classes to extract message IDs
Delivery checking logic
Break into smaller classes, use dependency injection
  -> TokenManager, IGP, Transferer, Delivery checker
Validation
  -> takes input and returns errors based on warp context
  -> would need balances + gas quote + igp quote
*/
