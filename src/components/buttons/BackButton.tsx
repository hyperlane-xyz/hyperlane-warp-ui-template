import LeftArrow from '../../images/icons/arrow-left-circle.svg';

import { IconButton, IconButtonProps } from './IconButton';

export function BackButton(props: IconButtonProps) {
  return <IconButton imgSrc={LeftArrow} title="Go back" {...props} />;
}
