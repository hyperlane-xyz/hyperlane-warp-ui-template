import { ProtocolType } from '@hyperlane-xyz/utils';

// IGP Quote overrides can be set here
// If specified, this value will be used instead of querying the token adapter
// Protocol to value | map<chainId,value>
export const DEFAULT_IGP_QUOTES: Partial<
  Record<ProtocolType, string | Record<string | number, string>>
> = {
  [ProtocolType.Sealevel]: '10000',
  [ProtocolType.Cosmos]: '270000',
};
