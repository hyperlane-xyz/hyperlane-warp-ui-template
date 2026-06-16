import type { MultiProtocolProvider, Token } from '@hyperlane-xyz/sdk';
import { isZeroishAddress, normalizeAddress, type ProtocolType } from '@hyperlane-xyz/utils';

import type { UiToken } from '../../swap/tokens/types';

const NATIVE_SUFFIX = 'native';

export function getBridgeTokenIdentity(token: Token, multiProvider: MultiProtocolProvider): string {
  const chainId = multiProvider.tryGetChainMetadata(token.chainName)?.chainId;
  const chainKey = chainId == null ? token.chainName.toLowerCase() : String(chainId);

  if (token.isNative() || token.isHypNative()) {
    return `${chainKey}-${NATIVE_SUFFIX}-${token.symbol.toLowerCase()}`;
  }

  const address = token.collateralAddressOrDenom || token.addressOrDenom;
  return `${chainKey}-${normalizeAddress(address, token.protocol)}`;
}

export function getSwapTokenIdentity(token: UiToken, protocol?: ProtocolType): string {
  if (token.isNative || isZeroishAddress(token.address)) {
    return `${token.chainId}-${NATIVE_SUFFIX}-${token.symbol.toLowerCase()}`;
  }

  return `${token.chainId}-${normalizeAddress(token.address, protocol)}`;
}

export function getUnifiedTokenKey(identity: string): string {
  return `unified-${identity}`;
}
