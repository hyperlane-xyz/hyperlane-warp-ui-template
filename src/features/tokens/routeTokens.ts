import { parseTokenConnectionId } from '@hyperlane-xyz/sdk/token/TokenConnection';
import { TokenMetadata } from '@hyperlane-xyz/sdk/token/TokenMetadata';
import type { WarpCoreConfig } from '@hyperlane-xyz/sdk/warp/types';
import { assert } from '@hyperlane-xyz/utils';

type TokenCtor<T extends TokenMetadata> = new (
  args: ConstructorParameters<typeof TokenMetadata>[0],
) => T;

// Metadata-first bootstrap needs token connectivity before the full runtime WarpCore exists.
// This reconstructs the lightweight TokenMetadata graph from config so init paths can build
// token lists, collateral groups, and router-address maps without eagerly loading runtime code.
export function buildRouteTokens<T extends TokenMetadata = TokenMetadata>(
  config: WarpCoreConfig,
  // CAST: defaulting a generic constructor parameter to TokenMetadata needs an
  // explicit bridge because T may be instantiated as a subtype at callsites.
  TokenCtor: TokenCtor<T> = TokenMetadata as unknown as TokenCtor<T>,
): T[] {
  const tokens = config.tokens.map(
    (token) =>
      new TokenCtor({
        ...token,
        addressOrDenom: token.addressOrDenom || '',
        connections: undefined,
      }),
  );
  const tokensByConnectionId = new Map<string, T[]>();
  for (const token of tokens) {
    const key = `${token.chainName}|${token.addressOrDenom}`;
    const existing = tokensByConnectionId.get(key) || [];
    existing.push(token);
    tokensByConnectionId.set(key, existing);
  }

  config.tokens.forEach((tokenConfig, index) => {
    for (const connection of tokenConfig.connections || []) {
      const token = tokens[index];
      assert(token, `Token config missing at index ${index}`);

      const { chainName, addressOrDenom } = parseTokenConnectionId(connection.token);
      const connectedToken = (
        tokensByConnectionId.get(`${chainName}|${addressOrDenom}`) || []
      ).find((candidate) => !token.warpRouteId || candidate.warpRouteId === token.warpRouteId);

      assert(connectedToken, `Connected token not found: ${chainName} ${addressOrDenom}`);

      token.addConnection({
        ...connection,
        token: connectedToken,
      });
    }
  });

  return tokens;
}
