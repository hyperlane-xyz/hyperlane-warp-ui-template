import { TokenStandard } from '@hyperlane-xyz/sdk';

export function isIntentStandard(standard: TokenStandard): boolean {
  return standard === TokenStandard.EvmIntent || standard === TokenStandard.EvmIntentNative;
}
