import type { ScaleInput } from '@hyperlane-xyz/sdk';
import { localAmountFromMessage, messageAmountFromLocal, scalesEqual } from '@hyperlane-xyz/sdk';
import { fromWei, toWei } from '@hyperlane-xyz/utils';

interface ScaledToken {
  decimals: number;
  scale?: ScaleInput;
}

/**
 * Computes the destination amount for a transfer when origin and destination
 * tokens have different scales. Returns null when scales are equal (no conversion needed).
 *
 * Converts: human amount → origin wei → message-space → dest wei → human amount
 */
export function computeDestAmount(
  amount: string,
  originToken: ScaledToken | undefined,
  destToken: ScaledToken | undefined,
): string | null {
  if (!originToken || !destToken) return null;
  if (!originToken.scale && !destToken.scale) return null;
  if (scalesEqual(originToken.scale, destToken.scale)) return null;

  try {
    const originWei = BigInt(toWei(amount, originToken.decimals));
    const messageAmount = messageAmountFromLocal(originWei, originToken.scale);
    const destWei = localAmountFromMessage(messageAmount, destToken.scale);
    return fromWei(destWei.toString(), destToken.decimals);
  } catch {
    return null;
  }
}
