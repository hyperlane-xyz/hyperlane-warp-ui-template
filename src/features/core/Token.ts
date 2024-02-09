/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import {
  ChainName,
  CosmIbcTokenAdapter,
  CosmNativeTokenAdapter,
  CwHypCollateralAdapter,
  CwHypNativeAdapter,
  CwHypSyntheticAdapter,
  CwNativeTokenAdapter,
  CwTokenAdapter,
  EvmHypCollateralAdapter,
  EvmHypSyntheticAdapter,
  EvmNativeTokenAdapter,
  EvmTokenAdapter,
  IHypTokenAdapter,
  ITokenAdapter,
  MultiProtocolProvider,
  SealevelHypCollateralAdapter,
  SealevelHypNativeAdapter,
  SealevelHypSyntheticAdapter,
  SealevelNativeTokenAdapter,
  SealevelTokenAdapter,
} from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { TokenAmount } from './TokenAmount';
import {
  Numberish,
  TOKEN_MULTI_CHAIN_STANDARDS,
  TOKEN_NFT_STANDARDS,
  TokenStandard,
} from './types';

export interface TokenArgs {
  protocol: ProtocolType;
  chainName: ChainName;
  standard: TokenStandard;
  addressOrDenom: Address | string;
  collateralizedAddressOrDenom?: Address | string;
  gasAddressOrDenom?: string;
  decimals: number;
  symbol: string;
  name: string;
  logoUri?: string;
  connectedTokens?: Token[];

  // Cosmos specific:
  sourcePort?: string;
  sourceChannel?: string;
}

// Declaring the interface in addition to class allows
// Typescript to infer the members vars from TokenArgs
export interface Token extends TokenArgs {}

export class Token {
  constructor(public readonly args: TokenArgs) {
    Object.assign(this, args);
  }

  /**
   * Returns a TokenAdapter for the token and multiProvider
   * @throws If multiProvider does not contain this token's chain.
   * @throws If token is an NFT (TODO NFT Adapter support)
   */
  getAdapter(multiProvider: MultiProtocolProvider): ITokenAdapter {
    const { standard, chainName, addressOrDenom } = this;

    if (this.isNft()) throw new Error('NFT adapters not yet supported');
    if (!multiProvider.tryGetChainMetadata(chainName))
      throw new Error(`Token chain ${chainName} not found in multiProvider`);

    if (standard === TokenStandard.ERC20) {
      return new EvmTokenAdapter(chainName, multiProvider, { token: addressOrDenom });
    } else if (standard === TokenStandard.EvmNative) {
      return new EvmNativeTokenAdapter(chainName, multiProvider, {});
    } else if (standard === TokenStandard.SealevelSpl) {
      return new SealevelTokenAdapter(chainName, multiProvider, { token: addressOrDenom }, false);
    } else if (standard === TokenStandard.SealevelSpl2022) {
      return new SealevelTokenAdapter(chainName, multiProvider, { token: addressOrDenom }, true);
    } else if (standard === TokenStandard.SealevelNative) {
      return new SealevelNativeTokenAdapter(chainName, multiProvider, {});
    } else if (standard === TokenStandard.CosmosIcs20) {
      throw new Error('Cosmos ICS20 token adapter not yet supported');
    } else if (standard === TokenStandard.CosmosNative) {
      return new CosmNativeTokenAdapter(chainName, multiProvider, {}, { ibcDenom: addressOrDenom });
    } else if (standard === TokenStandard.CosmosFactory) {
      throw new Error('Cosmos factory token adapter not yet supported');
    } else if (standard === TokenStandard.CW20) {
      // TODO pass in denom here somehow
      return new CwTokenAdapter(chainName, multiProvider, { token: addressOrDenom });
    } else if (standard === TokenStandard.CWNative) {
      return new CwNativeTokenAdapter(chainName, multiProvider, {}, addressOrDenom);
    } else if (this.isMultiChainToken()) {
      return this.getHypAdapter(multiProvider);
    } else {
      throw new Error(`No adapter found for token standard: ${standard}`);
    }
  }

  /**
   * Returns a HypTokenAdapter for the token and multiProvider
   * @throws If not applicable to this token's standard.
   * @throws If multiProvider does not contain this token's chain.
   * @throws If token is an NFT (TODO NFT Adapter support)
   */
  getHypAdapter(multiProvider: MultiProtocolProvider<{ mailbox?: Address }>): IHypTokenAdapter {
    const {
      protocol,
      standard,
      chainName,
      addressOrDenom,
      collateralizedAddressOrDenom,
      gasAddressOrDenom,
      sourcePort,
      sourceChannel,
    } = this;
    const chainMetadata = multiProvider.tryGetChainMetadata(chainName);
    const mailbox = chainMetadata?.mailbox;

    if (!this.isMultiChainToken())
      throw new Error(`Token standard ${standard} not applicable to hyp adapter`);
    if (this.isNft()) throw new Error('NFT adapters not yet supported');
    if (!chainMetadata) throw new Error(`Token chain ${chainName} not found in multiProvider`);

    let sealevelAddresses;
    if (protocol === ProtocolType.Sealevel) {
      if (!mailbox) throw new Error('mailbox required for Sealevel hyp tokens');
      if (!collateralizedAddressOrDenom)
        throw new Error('collateralizedAddressOrDenom required for Sealevel hyp tokens');
      sealevelAddresses = {
        warpRouter: addressOrDenom,
        token: collateralizedAddressOrDenom,
        mailbox,
      };
    }

    if (standard === TokenStandard.EvmHypNative || standard === TokenStandard.EvmHypCollateral) {
      return new EvmHypCollateralAdapter(chainName, multiProvider, { token: addressOrDenom });
    } else if (standard === TokenStandard.EvmHypSynthetic) {
      return new EvmHypSyntheticAdapter(chainName, multiProvider, { token: addressOrDenom });
    } else if (standard === TokenStandard.SealevelHypNative) {
      return new SealevelHypNativeAdapter(chainName, multiProvider, sealevelAddresses, false);
    } else if (standard === TokenStandard.SealevelHypCollateral) {
      return new SealevelHypCollateralAdapter(chainName, multiProvider, sealevelAddresses, false);
    } else if (standard === TokenStandard.SealevelHypSynthetic) {
      return new SealevelHypSyntheticAdapter(chainName, multiProvider, sealevelAddresses, false);
    } else if (standard === TokenStandard.CwHypNative) {
      return new CwHypNativeAdapter(
        chainName,
        multiProvider,
        { warpRouter: addressOrDenom },
        gasAddressOrDenom,
      );
    } else if (standard === TokenStandard.CwHypCollateral) {
      if (!collateralizedAddressOrDenom)
        throw new Error('collateralizedAddressOrDenom required for CwHypCollateral');
      return new CwHypCollateralAdapter(
        chainName,
        multiProvider,
        { warpRouter: addressOrDenom, token: collateralizedAddressOrDenom },
        gasAddressOrDenom,
      );
    } else if (standard === TokenStandard.CwHypSynthetic) {
      if (!collateralizedAddressOrDenom)
        throw new Error('collateralizedAddressOrDenom required for CwHypSyntheticAdapter');
      return new CwHypSyntheticAdapter(
        chainName,
        multiProvider,
        { warpRouter: addressOrDenom, token: collateralizedAddressOrDenom },
        gasAddressOrDenom,
      );
    } else if (standard === TokenStandard.CosmosIbc) {
      if (!sourcePort || !sourceChannel)
        throw new Error('sourcePort and sourceChannel required for IBC token adapters');
      return new CosmIbcTokenAdapter(
        chainName,
        multiProvider,
        {},
        { ibcDenom: addressOrDenom, sourcePort, sourceChannel },
      );
    } else {
      throw new Error(`No hyp adapter found for token standard: ${standard}`);
    }
  }

  getConnectedTokens(): Token[] {
    return this.connectedTokens || [];
  }

  setConnectedTokens(tokens: Token[]): Token[] {
    this.connectedTokens = tokens;
    return tokens;
  }

  amount(amount: Numberish): TokenAmount {
    return new TokenAmount(amount, this);
  }

  isNft(): boolean {
    return TOKEN_NFT_STANDARDS.includes(this.standard);
  }

  isMultiChainToken(): boolean {
    return TOKEN_MULTI_CHAIN_STANDARDS.includes(this.standard);
  }

  equals(token: Token): boolean {
    return (
      this.protocol === token.protocol &&
      this.chainName === token.chainName &&
      this.standard === token.standard &&
      this.decimals === token.decimals &&
      this.addressOrDenom.toLowerCase() === token.addressOrDenom.toLowerCase() &&
      this.collateralizedAddressOrDenom?.toLowerCase() ===
        token.collateralizedAddressOrDenom?.toLowerCase()
    );
  }
}
