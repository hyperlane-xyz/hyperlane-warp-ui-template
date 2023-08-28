import { Connection } from '@solana/web3.js';
import { providers } from 'ethers';

import { ProtocolType } from '@hyperlane-xyz/sdk';

import { convertToProtocolAddress } from '../../../utils/addresses';
import { parseCaip2Id } from '../../caip/chains';
import {
  AssetNamespace,
  getChainIdFromToken,
  isNativeToken,
  parseCaip19Id,
} from '../../caip/tokens';
import { getMultiProvider, getProvider } from '../../multiProvider';
import { Route } from '../routes/types';
import {
  isRouteFromCollateral,
  isRouteFromSynthetic,
  isRouteToCollateral,
  isRouteToSynthetic,
} from '../routes/utils';

import {
  EvmHypCollateralAdapter,
  EvmHypSyntheticAdapter,
  EvmNativeTokenAdapter,
  EvmTokenAdapter,
} from './EvmTokenAdapter';
import { IHypTokenAdapter } from './ITokenAdapter';
import {
  SealevelHypCollateralAdapter,
  SealevelHypNativeAdapter,
  SealevelHypSyntheticAdapter,
  SealevelNativeTokenAdapter,
  SealevelTokenAdapter,
} from './SealevelTokenAdapter';

export class AdapterFactory {
  static TokenAdapterFromAddress(tokenCaip19Id: TokenCaip19Id) {
    const { address, chainCaip2Id } = parseCaip19Id(tokenCaip19Id);
    const { protocol, reference } = parseCaip2Id(chainCaip2Id);
    if (protocol == ProtocolType.Ethereum) {
      const provider = getProvider(chainCaip2Id);
      return isNativeToken(tokenCaip19Id)
        ? new EvmNativeTokenAdapter(provider)
        : new EvmTokenAdapter(provider, address);
    } else if (protocol === ProtocolType.Sealevel) {
      const rpcUrl = getMultiProvider().getRpcUrl(reference);
      const connection = new Connection(rpcUrl, 'confirmed');
      return isNativeToken(tokenCaip19Id)
        ? new SealevelNativeTokenAdapter(connection)
        : new SealevelTokenAdapter(connection, address);
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }

  static HypCollateralAdapterFromAddress(baseTokenCaip19Id: TokenCaip19Id, routerAddress: Address) {
    return AdapterFactory.selectHypAdapter(
      getChainIdFromToken(baseTokenCaip19Id),
      routerAddress,
      baseTokenCaip19Id,
      EvmHypCollateralAdapter,
      isNativeToken(baseTokenCaip19Id) ? SealevelHypNativeAdapter : SealevelHypCollateralAdapter,
    );
  }

  static HypSyntheticTokenAdapterFromAddress(
    baseTokenCaip19Id: TokenCaip19Id,
    chainCaip2Id: ChainCaip2Id,
    routerAddress: Address,
  ) {
    return AdapterFactory.selectHypAdapter(
      chainCaip2Id,
      routerAddress,
      baseTokenCaip19Id,
      EvmHypSyntheticAdapter,
      SealevelHypSyntheticAdapter,
    );
  }

  static HypTokenAdapterFromRouteOrigin(route: Route) {
    const { type, originCaip2Id, originRouterAddress, baseTokenCaip19Id } = route;
    if (isRouteFromCollateral(route)) {
      return AdapterFactory.selectHypAdapter(
        originCaip2Id,
        originRouterAddress,
        baseTokenCaip19Id,
        EvmHypCollateralAdapter,
        isNativeToken(baseTokenCaip19Id) ? SealevelHypNativeAdapter : SealevelHypCollateralAdapter,
      );
    } else if (isRouteFromSynthetic(route)) {
      return AdapterFactory.selectHypAdapter(
        originCaip2Id,
        originRouterAddress,
        baseTokenCaip19Id,
        EvmHypSyntheticAdapter,
        SealevelHypSyntheticAdapter,
      );
    } else {
      throw new Error(`Unsupported route type: ${type}`);
    }
  }

  static HypTokenAdapterFromRouteDest(route: Route) {
    const { type, destCaip2Id, destRouterAddress, destTokenCaip19Id, baseTokenCaip19Id } = route;
    const tokenCaip19Id = destTokenCaip19Id || baseTokenCaip19Id;
    if (isRouteToCollateral(route)) {
      return AdapterFactory.selectHypAdapter(
        destCaip2Id,
        destRouterAddress,
        tokenCaip19Id,
        EvmHypCollateralAdapter,
        isNativeToken(tokenCaip19Id) ? SealevelHypNativeAdapter : SealevelHypCollateralAdapter,
      );
    } else if (isRouteToSynthetic(route)) {
      return AdapterFactory.selectHypAdapter(
        destCaip2Id,
        destRouterAddress,
        tokenCaip19Id,
        EvmHypSyntheticAdapter,
        SealevelHypSyntheticAdapter,
      );
    } else {
      throw new Error(`Unsupported route type: ${type}`);
    }
  }

  protected static selectHypAdapter(
    chainCaip2Id: ChainCaip2Id,
    routerAddress: Address,
    baseTokenCaip19Id: TokenCaip19Id,
    EvmAdapter: new (provider: providers.Provider, routerAddress: Address) => IHypTokenAdapter,
    SealevelAdapter: new (
      connection: Connection,
      routerAddress: Address,
      tokenAddress: Address,
      isSpl2022?: boolean,
    ) => IHypTokenAdapter,
  ) {
    const { protocol, reference } = parseCaip2Id(chainCaip2Id);
    const { address: baseTokenAddress, namespace } = parseCaip19Id(baseTokenCaip19Id);
    if (protocol == ProtocolType.Ethereum) {
      const provider = getProvider(chainCaip2Id);
      return new EvmAdapter(provider, convertToProtocolAddress(routerAddress, protocol));
    } else if (protocol === ProtocolType.Sealevel) {
      const rpcUrl = getMultiProvider().getRpcUrl(reference);
      const connection = new Connection(rpcUrl, 'confirmed');
      return new SealevelAdapter(
        connection,
        convertToProtocolAddress(routerAddress, protocol),
        convertToProtocolAddress(baseTokenAddress, protocol),
        namespace === AssetNamespace.spl2022,
      );
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }
}
