import Image from 'next/image';
import { memo } from 'react';

interface Props {
  tokenAddress?: string;
  chainId?: number;
  size?: number;
}

function _TokenIcon({ tokenAddress, chainId, size = 32 }: Props) {
  // TODO
  const imageSrc = null;
  // TODO
  const name = tokenAddress || '';

  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className="flex items-center justify-center rounded-full bg-gray-200 transition-all overflow-hidden"
      title={name}
    >
      {imageSrc && <Image src={imageSrc} alt="" width={size} height={size} />}
    </div>
  );
}

export const TokenIcon = memo(_TokenIcon);
