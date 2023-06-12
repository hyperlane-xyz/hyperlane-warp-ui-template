import { BigNumber } from 'ethers';
import Image from 'next/image';
import { memo } from 'react';

import { Circle } from '@hyperlane-xyz/widgets';

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

  const bgColorSeed =
    token && !imageSrc ? BigNumber.from(token.address?.substring(0, 4)).toNumber() % 5 : undefined;
  const fontSize = Math.floor(size / 2);

  return (
    <Circle size={size} bgColorSeed={bgColorSeed} title={title}>
      {imageSrc ? (
        <ErrorBoundary hideError={true}>
          <Image src={imageSrc} alt="" width={size} height={size} />
        </ErrorBoundary>
      ) : (
        <div className={`text-[${fontSize}px]`}>{character}</div>
      )}
    </Circle>
  );
}

export const TokenIcon = memo(_TokenIcon);
