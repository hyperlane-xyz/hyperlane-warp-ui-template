import { memo } from 'react';

import X from '../../images/icons/x.svg';
import { IconButton } from '../buttons/IconButton';

function _XIcon({
  onClick,
  title,
  size = 20,
}: {
  onClick: () => void;
  title?: string;
  size?: number;
}) {
  return (
    <IconButton imgSrc={X} title={title || 'Close'} width={size} height={size} onClick={onClick} />
  );
}

export const XIcon = memo(_XIcon);
