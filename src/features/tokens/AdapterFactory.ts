import {
  ChainName,
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
import { Address, ProtocolType, convertToProtocolAddress } from '@hyperlane-xyz/utils';

import { parseCaip2Id } from '../caip/chains';
import { AssetNamespace, getChainIdFromToken, isNativeToken, parseCaip19Id } from '../caip/tokens';
import { getMultiProvider } from '../multiProvider';

import { getToken } from './metadata';
import { Route } from './routes/types';
import {
  isIbcRoute,
  isIbcToWarpRoute,
  isRouteFromCollateral,
  isRouteFromSynthetic,
  isRouteToCollateral,
  isRouteToSynthetic,
  isWarpRoute,
} from './routes/utils';

export class AdapterFactory {
  static NativeAdapterFromChain(
    chainCaip2Id: ChainCaip2Id,
    useCosmNative = false,
    adapterProperties?: any,
  ): ITokenAdapter {
    const { protocol, reference: chainId } = parseCaip2Id(chainCaip2Id);
    const multiProvider = getMultiProvider();
    const chainName = multiProvider.getChainMetadata(chainId).name;
    if (protocol == ProtocolType.Ethereum) {
      return new EvmNativeTokenAdapter(chainName, multiProvider, {});
    } else if (protocol === ProtocolType.Sealevel) {
      return new SealevelNativeTokenAdapter(chainName, multiProvider, {});
    } else if (protocol === ProtocolType.Cosmos) {
      return useCosmNative
        ? new CosmNativeTokenAdapter(chainName, multiProvider, {}, adapterProperties)
        : new CwNativeTokenAdapter(chainName, multiProvider, {});
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }

  static NativeAdapterFromRoute(route: Route, source: 'origin' | 'destination'): ITokenAdapter {
    let useCosmNative = false;
    let adapterProperties: any = undefined;
    if (isIbcRoute(route)) {
      useCosmNative = true;
      adapterProperties = {
        ibcDenom: source === 'origin' ? route.originIbcDenom : route.derivedIbcDenom,
        sourcePort: route.sourcePort,
        sourceChannel: route.sourceChannel,
      };
    }
    return AdapterFactory.NativeAdapterFromChain(
      source === 'origin' ? route.originCaip2Id : route.destCaip2Id,
      useCosmNative,
      adapterProperties,
    );
  }

  static TokenAdapterFromAddress(tokenCaip19Id: TokenCaip19Id): ITokenAdapter {
    const { address, chainCaip2Id } = parseCaip19Id(tokenCaip19Id);
    const { protocol, reference: chainId } = parseCaip2Id(chainCaip2Id);
    const multiProvider = getMultiProvider();
    const chainName = multiProvider.getChainMetadata(chainId).name;
    const isNative = isNativeToken(tokenCaip19Id);
    if (protocol == ProtocolType.Ethereum) {
      return isNative
        ? new EvmNativeTokenAdapter(chainName, multiProvider, {})
        : new EvmTokenAdapter(chainName, multiProvider, { token: address });
    } else if (protocol === ProtocolType.Sealevel) {
      return isNative
        ? new SealevelNativeTokenAdapter(chainName, multiProvider, {})
        : new SealevelTokenAdapter(chainName, multiProvider, { token: address });
    } else if (protocol === ProtocolType.Cosmos) {
      return isNative
        ? new CwNativeTokenAdapter(chainName, multiProvider, {})
        : new CwTokenAdapter(chainName, multiProvider, { token: address });
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }

  static HypCollateralAdapterFromAddress(
    baseTokenCaip19Id: TokenCaip19Id,
    routerAddress: Address,
  ): IHypTokenAdapter {
    const isNative = isNativeToken(baseTokenCaip19Id);
    return AdapterFactory.selectHypAdapter(
      getChainIdFromToken(baseTokenCaip19Id),
      routerAddress,
      baseTokenCaip19Id,
      EvmHypCollateralAdapter,
      isNative ? SealevelHypNativeAdapter : SealevelHypCollateralAdapter,
      isNative ? CwHypNativeAdapter : CwHypCollateralAdapter,
    );
  }

  static HypSyntheticTokenAdapterFromAddress(
    baseTokenCaip19Id: TokenCaip19Id,
    chainCaip2Id: ChainCaip2Id,
    routerAddress: Address,
  ): IHypTokenAdapter {
    return AdapterFactory.selectHypAdapter(
      chainCaip2Id,
      routerAddress,
      baseTokenCaip19Id,
      EvmHypSyntheticAdapter,
      SealevelHypSyntheticAdapter,
      CwHypSyntheticAdapter,
    );
  }

  static HypTokenAdapterFromRouteOrigin(route: Route): IHypTokenAdapter {
    if (!isWarpRoute(route)) throw new Error('Route is not a hyp route');
    const { type, originCaip2Id, originRouterAddress, baseTokenCaip19Id } = route;
    const isNative = isNativeToken(baseTokenCaip19Id);
    if (isRouteFromCollateral(route)) {
      return AdapterFactory.selectHypAdapter(
        originCaip2Id,
        originRouterAddress,
        baseTokenCaip19Id,
        EvmHypCollateralAdapter,
        isNative ? SealevelHypNativeAdapter : SealevelHypCollateralAdapter,
        isNative ? CwHypNativeAdapter : CwHypCollateralAdapter,
      );
    } else if (isRouteFromSynthetic(route)) {
      return AdapterFactory.selectHypAdapter(
        originCaip2Id,
        originRouterAddress,
        baseTokenCaip19Id,
        EvmHypSyntheticAdapter,
        SealevelHypSyntheticAdapter,
        CwHypSyntheticAdapter,
      );
    } else {
      throw new Error(`Unsupported route type: ${type}`);
    }
  }

  static HypTokenAdapterFromRouteDest(route: Route): IHypTokenAdapter {
    if (!isWarpRoute(route) && !isIbcToWarpRoute(route))
      throw new Error('Route is not a hyp route');
    const { type, destCaip2Id, destRouterAddress, destTokenCaip19Id, baseTokenCaip19Id } = route;
    const tokenCaip19Id = destTokenCaip19Id || baseTokenCaip19Id;
    const isNative = isNativeToken(baseTokenCaip19Id);
    if (isRouteToCollateral(route) || isIbcToWarpRoute(route)) {
      return AdapterFactory.selectHypAdapter(
        destCaip2Id,
        destRouterAddress,
        tokenCaip19Id,
        EvmHypCollateralAdapter,
        isNative ? SealevelHypNativeAdapter : SealevelHypCollateralAdapter,
        isNative ? CwHypNativeAdapter : CwHypCollateralAdapter,
      );
    } else if (isRouteToSynthetic(route)) {
      return AdapterFactory.selectHypAdapter(
        destCaip2Id,
        destRouterAddress,
        tokenCaip19Id,
        EvmHypSyntheticAdapter,
        SealevelHypSyntheticAdapter,
        CwHypSyntheticAdapter,
      );
    } else {
      throw new Error(`Unsupported route type: ${type}`);
    }
  }

  protected static selectHypAdapter(
    chainCaip2Id: ChainCaip2Id,
    routerAddress: Address,
    baseTokenCaip19Id: TokenCaip19Id,
    EvmAdapter: new (
      chainName: ChainName,
      mp: MultiProtocolProvider,
      addresses: { token: Address },
    ) => IHypTokenAdapter,
    SealevelAdapter: new (
      chainName: ChainName,
      mp: MultiProtocolProvider,
      addresses: { token: Address; warpRouter: Address; mailbox: Address },
      isSpl2022?: boolean,
    ) => IHypTokenAdapter,
    CosmosAdapter: new (
      chainName: ChainName,
      mp: MultiProtocolProvider,
      addresses: any,
      gasDenom?: string,
    ) => IHypTokenAdapter,
  ): IHypTokenAdapter {
    const { protocol, reference: chainId } = parseCaip2Id(chainCaip2Id);
    const { address: baseTokenAddress, namespace } = parseCaip19Id(baseTokenCaip19Id);
    const tokenMetadata = getToken(baseTokenCaip19Id);
    if (!tokenMetadata) throw new Error(`Token metadata not found for ${baseTokenCaip19Id}`);
    const multiProvider = getMultiProvider();
    const { name: chainName, mailbox, bech32Prefix } = multiProvider.getChainMetadata(chainId);

    if (protocol == ProtocolType.Ethereum) {
      return new EvmAdapter(chainName, multiProvider, {
        token: convertToProtocolAddress(routerAddress, protocol),
      });
    } else if (protocol === ProtocolType.Sealevel) {
      if (!mailbox) throw new Error('Mailbox address required for sealevel hyp adapter');
      return new SealevelAdapter(
        chainName,
        multiProvider,
        {
          token: convertToProtocolAddress(baseTokenAddress, protocol),
          warpRouter: convertToProtocolAddress(routerAddress, protocol),
          mailbox,
        },
        namespace === AssetNamespace.spl2022,
      );
    } else if (protocol === ProtocolType.Cosmos) {
      if (!bech32Prefix) throw new Error('Bech32 prefix required for cosmos hyp adapter');
      return new CosmosAdapter(
        chainName,
        multiProvider,
        {
          token: convertToProtocolAddress(baseTokenAddress, protocol, bech32Prefix),
          warpRouter: convertToProtocolAddress(routerAddress, protocol, bech32Prefix),
        },
        tokenMetadata.igpTokenAddress || baseTokenAddress,
      );
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }
}
