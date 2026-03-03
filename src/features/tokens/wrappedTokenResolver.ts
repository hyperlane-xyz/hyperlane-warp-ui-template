import {
  IHypTokenAdapter,
  LOCKBOX_STANDARDS,
  MultiProtocolProvider,
  Token,
  TokenStandard,
} from '@hyperlane-xyz/sdk';
import { ProtocolType, normalizeAddress } from '@hyperlane-xyz/utils';
import { logger } from '../../utils/logger';
import { getTokenKey } from './utils';

// Standards whose collateralAddressOrDenom points to a wrapper, not the actual underlying ERC20.
// getWrappedTokenAddress() on the adapter resolves the real underlying address.
const WRAPPED_COLLATERAL_STANDARDS: string[] = [
  ...LOCKBOX_STANDARDS,
  TokenStandard.EvmHypOwnerCollateral,
];

/**
 * Resolve the actual underlying ERC20 address for lockbox/vault tokens
 * via token.getHypAdapter().getWrappedTokenAddress().
 *
 * Returns Map<tokenKey, resolvedUnderlyingAddress> (normalized, lowercase).
 * Tokens that fail resolution are silently omitted (current behavior preserved).
 */
export async function resolveWrappedCollateralTokens(
  allTokens: Token[],
  multiProvider: MultiProtocolProvider,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  const eligibleTokens = allTokens.filter(
    (t) =>
      t.protocol === ProtocolType.Ethereum && WRAPPED_COLLATERAL_STANDARDS.includes(t.standard),
  );

  if (eligibleTokens.length === 0) return result;

  const resolvePromises = eligibleTokens.map(async (token) => {
    try {
      const adapter = token.getHypAdapter(multiProvider) as IHypTokenAdapter<unknown> & {
        getWrappedTokenAddress?: () => Promise<string>;
      };
      if (!adapter.getWrappedTokenAddress) return;
      const underlying = await adapter.getWrappedTokenAddress();
      result.set(getTokenKey(token), normalizeAddress(underlying));
    } catch (err) {
      logger.warn(`wrappedToken resolution failed for ${token.symbol} on ${token.chainName}`, err);
    }
  });

  await Promise.allSettled(resolvePromises);
  return result;
}
