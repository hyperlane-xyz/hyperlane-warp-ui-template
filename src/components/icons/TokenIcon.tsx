import { BigNumber } from 'ethers';
import Image from 'next/image';
import { memo } from 'react';

import { TokenMetadata } from '../../features/tokens/types';
import { isValidUrl } from '../../utils/url';
import { ErrorBoundary } from '../errors/ErrorBoundary';

interface Props {
  token?: TokenMetadata;
  size?: number;
}

function _TokenIcon({ token, size = 32 }: Props) {
  const imageSrc = isValidUrl(token?.logoURI) ? token!.logoURI : null;
  const title = token?.symbol || '';
  const character = title ? title.charAt(0).toUpperCase() : '';

  const bgColor = getBackgroundColor(token && !imageSrc ? token.address : undefined);
  const fontSize = Math.floor(size / 2);

  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`flex items-center justify-center rounded-full ${bgColor} transition-all overflow-hidden`}
      title={title}
    >
      {imageSrc ? (
        <ErrorBoundary hideError={true}>
          <Image src={imageSrc} alt="" width={size} height={size} />
        </ErrorBoundary>
      ) : (
        <div className={`text-[${fontSize}px]`}>{character}</div>
      )}
    </div>
  );
}

// TODO de-dupe with https://github.com/hyperlane-xyz/hyperlane-widgets/blob/main/src/icons/ChainLogo.tsx
function getBackgroundColor(address?: Address) {
  if (!address) return 'bg-gray-200';
  const seed = BigNumber.from(address.substring(0, 4)).toNumber() % 5;
  switch (seed) {
    case 0:
      return 'bg-blue-100';
    case 1:
      return 'bg-pink-200';
    case 2:
      return 'bg-green-100';
    case 3:
      return 'bg-orange-200';
    case 4:
      return 'bg-violet-200';
    default:
      return 'bg-gray-200';
  }
}

export const TokenIcon = memo(_TokenIcon);
