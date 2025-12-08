import { IToken } from '@hyperlane-xyz/sdk';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { TokenIcon } from '../../components/icons/TokenIcon';

interface Props {
  token?: IToken | null;
  size?: number;
  chainName?: string; // Optional override, defaults to token.chainName
}

export function TokenChainIcon({ token, size = 32, chainName }: Props) {
  const chain = chainName || token?.chainName;
  const chainLogoSize = Math.max(Math.floor(size * 0.45), 12);

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <TokenIcon token={token} size={size} />
      {chain && (
        <div
          className="absolute rounded-full border border-white bg-white"
          style={{
            bottom: -2,
            right: -2,
            width: chainLogoSize + 2,
            height: chainLogoSize + 2,
          }}
        >
          <ChainLogo chainName={chain} size={chainLogoSize} />
        </div>
      )}
    </div>
  );
}
