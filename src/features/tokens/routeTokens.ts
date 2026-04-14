import { parseTokenConnectionId } from '@hyperlane-xyz/sdk/token/TokenConnection';
import { TokenMetadata } from '@hyperlane-xyz/sdk/token/TokenMetadata';
import { assert } from '@hyperlane-xyz/utils';
import type { WarpCoreConfig } from '@hyperlane-xyz/sdk/warp/types';

// Metadata-first bootstrap needs token connectivity before the full runtime WarpCore exists.
// This reconstructs the lightweight TokenMetadata graph from config so init paths can build
// token lists, collateral groups, and router-address maps without eagerly loading runtime code.
export function buildRouteTokens(config: WarpCoreConfig): TokenMetadata[] {
  const tokens = config.tokens.map(
    (token) =>
      new TokenMetadata({
        ...token,
        addressOrDenom: token.addressOrDenom || '',
        connections: undefined,
      }),
  );

  config.tokens.forEach((tokenConfig, index) => {
    for (const connection of tokenConfig.connections || []) {
      const token = tokens[index];
      if (!token) throw new Error(`Token config missing at index ${index}`);

      const { chainName, addressOrDenom } = parseTokenConnectionId(connection.token);
      const connectedToken = tokens.find(
        (candidate) =>
          candidate.chainName === chainName &&
          candidate.addressOrDenom === addressOrDenom &&
          (!token.warpRouteId || candidate.warpRouteId === token.warpRouteId),
      );

      assert(connectedToken, `Connected token not found: ${chainName} ${addressOrDenom}`);

      token.addConnection({
        ...connection,
        token: connectedToken,
      });
    }
  });

  return tokens;
}
