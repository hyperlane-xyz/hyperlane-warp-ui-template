import type { IToken } from '@hyperlane-xyz/sdk';

import { ChainLogo } from './ChainLogo';
import { TokenIcon } from './TokenIcon';

// Structural shape — satisfied by SDK `Token`/`IToken` and the engine-derived
// `UiToken`. Use the lowest-common-denominator
// fields TokenIcon actually accesses so we don't have to depend on either
// concrete type here.
interface IconToken {
  symbol: string;
  chainName: string;
  addressOrDenom: string;
  logoURI?: string;
}

interface Props {
  token: IconToken;
  size?: number;
}

export function TokenChainIcon({ token, size = 32 }: Props) {
  // Chain logo is 45% of token size, with minimum of 12px
  const chainLogoSize = Math.max(Math.floor(size * 0.45), 12);
  // Add 2px padding around chain logo for the white border/background
  const chainLogoContainerSize = chainLogoSize + 2;

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <TokenIcon token={token as unknown as IToken} size={size} />
      <div
        className="absolute -bottom-0.5 -right-0.5 rounded-full border border-white bg-white dark:border-white/[0.22] dark:bg-surface"
        style={{
          width: chainLogoContainerSize,
          height: chainLogoContainerSize,
        }}
      >
        <ChainLogo chainName={token.chainName} size={chainLogoSize} />
      </div>
    </div>
  );
}
