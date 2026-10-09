import { ProtocolType } from '@hyperlane-xyz/utils';

export enum WARP_QUERY_PARAMS {
  ORIGIN = 'origin',
  DESTINATION = 'destination',
  ORIGIN_TOKEN = 'originToken',
  DESTINATION_TOKEN = 'destinationToken',
}

export const ADD_ASSET_SUPPORTED_PROTOCOLS: ProtocolType[] = [ProtocolType.Ethereum];
