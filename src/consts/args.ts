import { ProtocolType } from '@hyperlane-xyz/utils';

export enum WARP_QUERY_PARAMS {
  ORIGIN = 'origin',
  DESTINATION = 'destination',
  TOKEN = 'token',
}

export const ADD_ASSET_SUPPORTED_PROTOCOLS: ProtocolType[] = [ProtocolType.Ethereum];
