import Image from 'next/image';
import { memo } from 'react';

import { ListedToken } from '../../features/tokens/types';
import { isValidHttpsUrl } from '../../utils/url';
import { ErrorBoundary } from '../errors/ErrorBoundary';

interface Props {
  token?: ListedToken;
  size?: number;
}

function _TokenIcon({ token, size = 32 }: Props) {
  const imageSrc = isValidHttpsUrl(token?.logoURI) ? token!.logoURI : null;
  const title = token?.symbol || '';

  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className="flex items-center justify-center rounded-full bg-gray-200 transition-all overflow-hidden"
      title={title}
    >
      <ErrorBoundary hideError={true}>
        {imageSrc && <Image src={imageSrc} alt="" width={size} height={size} />}
      </ErrorBoundary>
    </div>
  );
}

export const TokenIcon = memo(_TokenIcon);
