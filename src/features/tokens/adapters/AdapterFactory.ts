import { getSolanaClusterName } from '../../../consts/solanaChains';
import { parseCaip2Id } from '../../chains/caip2';
import { ProtocolType } from '../../chains/types';
import { getProvider } from '../../multiProvider';
import { isNativeToken } from '../native';

import {
  EvmHypCollateralAdapter,
  EvmHypTokenAdapter,
  EvmNativeTokenAdapter,
  EvmTokenAdapter,
} from './EvmTokenAdapter';
import {
  SealevelHypTokenAdapter,
  SealevelNativeTokenAdapter,
  SealevelTokenAdapter,
} from './SealevelTokenAdapter';

export class AdapterFactory {
  static TokenAdapterFromAddress(caip2Id: Caip2Id, address: Address) {
    const { protocol, reference } = parseCaip2Id(caip2Id);
    if (protocol == ProtocolType.Ethereum) {
      const provider = getProvider(caip2Id);
      if (isNativeToken(address)) {
        return new EvmNativeTokenAdapter(provider);
      } else {
        return new EvmTokenAdapter(provider, address);
      }
    } else if (protocol === ProtocolType.Sealevel) {
      const cluster = getSolanaClusterName(reference);
      if (isNativeToken(address)) {
        return new SealevelNativeTokenAdapter(cluster);
      } else {
        return new SealevelTokenAdapter(cluster, address);
      }
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }

  static HypTokenAdapterFromAddress(caip2Id: Caip2Id, address: Address) {
    const { protocol, reference } = parseCaip2Id(caip2Id);
    if (protocol == ProtocolType.Ethereum) {
      const provider = getProvider(caip2Id);
      return new EvmHypTokenAdapter(provider, address);
    } else if (protocol === ProtocolType.Sealevel) {
      const cluster = getSolanaClusterName(reference);
      return new SealevelHypTokenAdapter(cluster, address);
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }

  static CollateralAdapterFromAddress(caip2Id: Caip2Id, address: Address) {
    const { protocol, reference } = parseCaip2Id(caip2Id);
    if (protocol == ProtocolType.Ethereum) {
      const provider = getProvider(caip2Id);
      return new EvmHypCollateralAdapter(provider, address);
    } else if (protocol === ProtocolType.Sealevel) {
      const cluster = getSolanaClusterName(reference);
      return new SealevelHypTokenAdapter(cluster, address);
    } else {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }
}
