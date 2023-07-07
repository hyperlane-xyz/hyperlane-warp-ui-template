import { Connection } from '@solana/web3.js';
import { providers } from 'ethers';

import { convertToProtocolAddress } from '../../../utils/addresses';
import { parseCaip2Id } from '../../chains/caip2';
import { ProtocolType } from '../../chains/types';
import { getMultiProvider, getProvider } from '../../multiProvider';
import { isNativeToken } from '../native';
import { Route, RouteType } from '../routes/types';

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
  static TokenAdapterFromAddress(caip2Id: Caip2Id, address: Address) {
    const { protocol, reference } = parseCaip2Id(caip2Id);
    if (protocol == ProtocolType.Ethereum) {
      const provider = getProvider(caip2Id);
      return isNativeToken(address)
        ? new EvmNativeTokenAdapter(provider)
        : new EvmTokenAdapter(provider, address);
    } else if (protocol === ProtocolType.Sealevel) {
      const rpcUrl = getMultiProvider().getRpcUrl(reference);
      const connection = new Connection(rpcUrl, 'confirmed');
      return isNativeToken(address)
        ? new SealevelNativeTokenAdapter(connection)
        : new SealevelTokenAdapter(connection, address);
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }

  static HypCollateralAdapterFromAddress(
    caip2Id: Caip2Id,
    routerAddress: Address,
    tokenAddress: Address,
    isSpl2022?: boolean,
  ) {
    return AdapterFactory.selectHypAdapter(
      caip2Id,
      routerAddress,
      tokenAddress,
      EvmHypCollateralAdapter,
      isNativeToken(tokenAddress) ? SealevelHypNativeAdapter : SealevelHypCollateralAdapter,
      isSpl2022,
    );
  }

  static HypSyntheticAdapterFromAddress(
    caip2Id: Caip2Id,
    routerAddress: Address,
    tokenAddress: Address,
    isSpl2022?: boolean,
  ) {
    return AdapterFactory.selectHypAdapter(
      caip2Id,
      routerAddress,
      tokenAddress,
      EvmHypSyntheticAdapter,
      SealevelHypSyntheticAdapter,
      isSpl2022,
    );
  }

  static HypTokenAdapterFromRouteOrigin(route: Route) {
    const { type, originCaip2Id, originRouterAddress, baseTokenAddress } = route;
    if (type === RouteType.BaseToSynthetic) {
      return AdapterFactory.selectHypAdapter(
        originCaip2Id,
        originRouterAddress,
        baseTokenAddress,
        EvmHypCollateralAdapter,
        isNativeToken(baseTokenAddress) ? SealevelHypNativeAdapter : SealevelHypCollateralAdapter,
        route.isSpl2022,
      );
    } else if (type === RouteType.SyntheticToBase || type === RouteType.SyntheticToSynthetic) {
      return AdapterFactory.selectHypAdapter(
        originCaip2Id,
        originRouterAddress,
        baseTokenAddress,
        EvmHypSyntheticAdapter,
        SealevelHypSyntheticAdapter,
        route.isSpl2022,
      );
    } else {
      throw new Error(`Unsupported route type: ${type}`);
    }
  }

  static HypTokenAdapterFromRouteDest(route: Route) {
    const { type, destCaip2Id, destRouterAddress, baseTokenAddress } = route;
    if (type === RouteType.SyntheticToBase) {
      return AdapterFactory.selectHypAdapter(
        destCaip2Id,
        destRouterAddress,
        baseTokenAddress,
        EvmHypCollateralAdapter,
        isNativeToken(baseTokenAddress) ? SealevelHypNativeAdapter : SealevelHypCollateralAdapter,
        route.isSpl2022,
      );
    } else if (type === RouteType.BaseToSynthetic || type === RouteType.SyntheticToSynthetic) {
      return AdapterFactory.selectHypAdapter(
        destCaip2Id,
        destRouterAddress,
        baseTokenAddress,
        EvmHypSyntheticAdapter,
        SealevelHypSyntheticAdapter,
        route.isSpl2022,
      );
    } else {
      throw new Error(`Unsupported route type: ${type}`);
    }
  }

  protected static selectHypAdapter(
    caip2Id: Caip2Id,
    routerAddress: Address,
    tokenAddress: Address,
    EvmAdapter: new (provider: providers.Provider, routerAddress: Address) => IHypTokenAdapter,
    SealevelAdapter: new (
      connection: Connection,
      routerAddress: Address,
      tokenAddress: Address,
      isSpl2022?: boolean,
    ) => IHypTokenAdapter,
    isSpl2022?: boolean,
  ) {
    const { protocol, reference } = parseCaip2Id(caip2Id);
    if (protocol == ProtocolType.Ethereum) {
      const provider = getProvider(caip2Id);
      return new EvmAdapter(provider, convertToProtocolAddress(routerAddress, protocol));
    } else if (protocol === ProtocolType.Sealevel) {
      const rpcUrl = getMultiProvider().getRpcUrl(reference);
      const connection = new Connection(rpcUrl, 'confirmed');
      return new SealevelAdapter(
        connection,
        convertToProtocolAddress(routerAddress, protocol),
        convertToProtocolAddress(tokenAddress, protocol),
        isSpl2022,
      );
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }
}
