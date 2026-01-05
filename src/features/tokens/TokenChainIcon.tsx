import { IToken } from '@hyperlane-xyz/sdk';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { TokenIcon } from '../../components/icons/TokenIcon';

interface Props {
  token: IToken;
  size?: number;
}

export function TokenChainIcon({ token, size = 32 }: Props) {
  // Chain logo is 45% of token size, with minimum of 12px
  const chainLogoSize = Math.max(Math.floor(size * 0.45), 12);
  // Add 2px padding around chain logo for the white border/background
  const chainLogoContainerSize = chainLogoSize + 2;

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <TokenIcon token={token} size={size} />
      <div
        className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full"
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
