import { getProtocolType } from '../../chains/caip2';
import { ProtocolType } from '../../chains/types';
import { getProvider } from '../../multiProvider';
import { TokenMetadata } from '../types';
import { isNativeToken } from '../utils';

import {
  EvmHypCollateralAdapter,
  EvmHypTokenAdapter,
  EvmNativeTokenAdapter,
  EvmTokenAdapter,
} from './EvmTokenAdapter';
import { ITokenAdapter } from './ITokenAdapter';

export class AdapterFactory {
  static TokenAdapterFromAddress(caip2Id: Caip2Id, address: Address) {
    const protocol = getProtocolType(caip2Id);
    if (protocol == ProtocolType.Ethereum) {
      const provider = getProvider(caip2Id);
      if (isNativeToken(address)) {
        return new EvmNativeTokenAdapter(provider);
      } else {
        return new EvmTokenAdapter(provider, address);
      }
    } else if (protocol === ProtocolType.Sealevel) {
      // TODO solana support
      throw new Error('TODO');
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }

  static TokenAdapterFromToken(token: TokenMetadata): ITokenAdapter {
    const { caip2Id, address } = token;
    return AdapterFactory.TokenAdapterFromAddress(caip2Id, address);
  }

  static HypTokenAdapterFromAddress(caip2Id: Caip2Id, address: Address) {
    const protocol = getProtocolType(caip2Id);
    if (protocol == ProtocolType.Ethereum) {
      const provider = getProvider(caip2Id);
      return new EvmHypTokenAdapter(provider, address);
    } else if (protocol === ProtocolType.Sealevel) {
      // TODO solana support
      throw new Error('TODO');
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }

  static HypTokenAdapterFromToken(token: TokenMetadata): ITokenAdapter {
    const { caip2Id, address } = token;
    return AdapterFactory.HypTokenAdapterFromAddress(caip2Id, address);
  }

  static CollateralAdapterFromAddress(caip2Id: Caip2Id, address: Address) {
    const protocol = getProtocolType(caip2Id);
    if (protocol == ProtocolType.Ethereum) {
      const provider = getProvider(caip2Id);
      return new EvmHypCollateralAdapter(provider, address);
    } else if (protocol === ProtocolType.Sealevel) {
      // TODO solana support
      throw new Error('TODO');
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }

  static CollateralAdapterFromToken(token: TokenMetadata): ITokenAdapter {
    const { caip2Id, address } = token;
    return AdapterFactory.CollateralAdapterFromAddress(caip2Id, address);
  }
}
