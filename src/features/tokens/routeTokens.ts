import { TokenMetadata } from '@hyperlane-xyz/sdk/token/TokenMetadata';
import { parseTokenConnectionId } from '@hyperlane-xyz/sdk/token/TokenConnection';
import type { WarpCoreConfig } from '@hyperlane-xyz/sdk/warp/types';

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

      if (!connectedToken) {
        throw new Error(`Connected token not found: ${chainName} ${addressOrDenom}`);
      }

      token.addConnection({
        ...connection,
        token: connectedToken,
      });
    }
  });

  return tokens;
}
