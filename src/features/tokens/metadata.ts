import { getWarpContext } from '../../context/context';

import { IbcTokenTypes, TokenMetadata } from './types';

export function getTokens() {
  return getWarpContext()?.tokens || [];
}

export function getToken(tokenCaip19Id: TokenCaip19Id) {
  return getTokens().find((t) => t.tokenCaip19Id === tokenCaip19Id);
}

export function findTokensByAddress(address: Address) {
  return getTokens().filter((t) => t.tokenCaip19Id.includes(address));
}

export function isIbcToken(token: TokenMetadata) {
  return Object.values(IbcTokenTypes).includes(token.type as IbcTokenTypes);
}
