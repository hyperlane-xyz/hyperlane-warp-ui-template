import type { ScaleInput } from '@hyperlane-xyz/sdk';
import { localAmountFromMessage, messageAmountFromLocal, scalesEqual } from '@hyperlane-xyz/sdk';
import { fromWei, normalizeAddress, toWei } from '@hyperlane-xyz/utils';

import { logger } from '../../utils/logger';
import type { RouterAddressInfo } from '../routerAddresses';

export interface ScaledToken {
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
  originToken: ScaledToken | null | undefined,
  destToken: ScaledToken | null | undefined,
): string | null {
  if (!originToken || !destToken) return null;
  if (!originToken.scale && !destToken.scale) return null;
  if (scalesEqual(originToken.scale, destToken.scale)) return null;

  try {
    const originWei = BigInt(toWei(amount, originToken.decimals));
    const messageAmount = messageAmountFromLocal(originWei, originToken.scale);
    const destWei = localAmountFromMessage(messageAmount, destToken.scale);
    return fromWei(destWei.toString(), destToken.decimals);
  } catch (e) {
    logger.error('Failed to compute dest amount', e);
    return null;
  }
}

/**
 * Formats a raw message-body amount into a human-readable local amount string.
 * For tokens with scale, converts from message-space to local units first.
 * Falls back to wireDecimals for tokens without scale.
 */
export function formatMessageAmount(
  rawAmount: string,
  token: ScaledToken & { addressOrDenom?: string },
  routerAddressesByChainMap: Record<string, Record<string, RouterAddressInfo>>,
  chainName: string,
): string {
  if (token.scale) {
    const messageAmount = BigInt(rawAmount);
    const localAmount = localAmountFromMessage(messageAmount, token.scale);
    return fromWei(localAmount.toString(), token.decimals);
  }
  const normalizedAddr = token.addressOrDenom ? normalizeAddress(token.addressOrDenom) : '';
  const routerInfo = routerAddressesByChainMap[chainName]?.[normalizedAddr];
  const wireDecimals = routerInfo?.wireDecimals ?? token.decimals;
  return fromWei(rawAmount, wireDecimals);
}
