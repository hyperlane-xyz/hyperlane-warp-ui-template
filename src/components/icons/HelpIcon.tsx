import { memo } from 'react';
import { toast } from 'react-toastify';

import Question from '../../images/icons/question-circle.svg';
import { IconButton } from '../buttons/IconButton';

function _HelpIcon({ text, size = 20 }: { text: string; size?: number }) {
  const onClick = () => {
    toast.info(text, { autoClose: 8000 });
  };

  return (
    <IconButton
      imgSrc={Question}
      title="Help"
      width={size}
      height={size}
      onClick={onClick}
      classes="opacity-50"
    />
  );
}

export const HelpIcon = memo(_HelpIcon);
