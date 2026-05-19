import { localAmountFromMessage, type ScaleInput } from '@hyperlane-xyz/sdk';
import { fromWei } from '@hyperlane-xyz/utils';

export interface ScaledToken {
  decimals: number;
  scale?: ScaleInput;
}

// Formats a raw atomic / message-body amount into a human-readable local
// amount string. For tokens with `scale`, converts message-space → local
// before applying decimals. (Not wired into SwapForm display yet.)
export function formatMessageAmount(rawAmount: string, token: ScaledToken): string {
  if (token.scale) {
    const messageAmount = BigInt(rawAmount);
    const localAmount = localAmountFromMessage(messageAmount, token.scale);
    return fromWei(localAmount.toString(), token.decimals);
  }
  return fromWei(rawAmount, token.decimals);
}
