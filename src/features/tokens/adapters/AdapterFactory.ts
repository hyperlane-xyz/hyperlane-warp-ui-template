import { Connection } from '@solana/web3.js';
import { providers } from 'ethers';

import { ProtocolType } from '@hyperlane-xyz/sdk';

import { convertToProtocolAddress } from '../../../utils/addresses';
import { parseCaip2Id } from '../../caip/chains';
import { AssetNamespace, getCaip2FromToken, isNativeToken, parseCaip19Id } from '../../caip/tokens';
import { getMultiProvider, getProvider } from '../../multiProvider';
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
  static TokenAdapterFromAddress(caip19Id: Caip19Id) {
    const { address, caip2Id } = parseCaip19Id(caip19Id);
    const { protocol, reference } = parseCaip2Id(caip2Id);
    if (protocol == ProtocolType.Ethereum) {
      const provider = getProvider(caip2Id);
      return isNativeToken(caip19Id)
        ? new EvmNativeTokenAdapter(provider)
        : new EvmTokenAdapter(provider, address);
    } else if (protocol === ProtocolType.Sealevel) {
      const rpcUrl = getMultiProvider().getRpcUrl(reference);
      const connection = new Connection(rpcUrl, 'confirmed');
      return isNativeToken(caip19Id)
        ? new SealevelNativeTokenAdapter(connection)
        : new SealevelTokenAdapter(connection, address);
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }

  static HypCollateralAdapterFromAddress(caip19Id: Caip19Id, routerAddress: Address) {
    const caip2Id = getCaip2FromToken(caip19Id);
    return AdapterFactory.selectHypAdapter(
      caip2Id,
      routerAddress,
      caip19Id,
      EvmHypCollateralAdapter,
      isNativeToken(caip19Id) ? SealevelHypNativeAdapter : SealevelHypCollateralAdapter,
    );
  }

  static HypTokenAdapterFromRouteOrigin(route: Route) {
    const { type, originCaip2Id, originRouterAddress, baseCaip19Id } = route;
    if (type === RouteType.BaseToSynthetic) {
      return AdapterFactory.selectHypAdapter(
        originCaip2Id,
        originRouterAddress,
        baseCaip19Id,
        EvmHypCollateralAdapter,
        isNativeToken(baseCaip19Id) ? SealevelHypNativeAdapter : SealevelHypCollateralAdapter,
      );
    } else if (type === RouteType.SyntheticToBase || type === RouteType.SyntheticToSynthetic) {
      return AdapterFactory.selectHypAdapter(
        originCaip2Id,
        originRouterAddress,
        baseCaip19Id,
        EvmHypSyntheticAdapter,
        SealevelHypSyntheticAdapter,
      );
    } else {
      throw new Error(`Unsupported route type: ${type}`);
    }
  }

  static HypTokenAdapterFromRouteDest(route: Route) {
    const { type, destCaip2Id, destRouterAddress, baseCaip19Id } = route;
    if (type === RouteType.SyntheticToBase) {
      return AdapterFactory.selectHypAdapter(
        destCaip2Id,
        destRouterAddress,
        baseCaip19Id,
        EvmHypCollateralAdapter,
        isNativeToken(baseCaip19Id) ? SealevelHypNativeAdapter : SealevelHypCollateralAdapter,
      );
    } else if (type === RouteType.BaseToSynthetic || type === RouteType.SyntheticToSynthetic) {
      return AdapterFactory.selectHypAdapter(
        destCaip2Id,
        destRouterAddress,
        baseCaip19Id,
        EvmHypSyntheticAdapter,
        SealevelHypSyntheticAdapter,
      );
    } else {
      throw new Error(`Unsupported route type: ${type}`);
    }
  }

  protected static selectHypAdapter(
    caip2Id: Caip2Id,
    routerAddress: Address,
    baseCaip19Id: Caip19Id,
    EvmAdapter: new (provider: providers.Provider, routerAddress: Address) => IHypTokenAdapter,
    SealevelAdapter: new (
      connection: Connection,
      routerAddress: Address,
      tokenAddress: Address,
      isSpl2022?: boolean,
    ) => IHypTokenAdapter,
  ) {
    const { protocol, reference } = parseCaip2Id(caip2Id);
    const { address: baseTokenAddress, namespace } = parseCaip19Id(baseCaip19Id);
    if (protocol == ProtocolType.Ethereum) {
      const provider = getProvider(caip2Id);
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
