import Image from 'next/image';
import { useState } from 'react';

import CheckmarkIcon from '../../images/icons/checkmark.svg';
import CopyIcon from '../../images/icons/copy-stack.svg';
import { tryClipboardSet } from '../../utils/clipboard';

interface Props {
  width: number;
  height: number;
  copyValue: string;
  classes?: string;
}

export function CopyButton({ width, height, copyValue, classes }: Props) {
  const [showCheckmark, setShowCheckmark] = useState(false);

  const onClick = async () => {
    const result = await tryClipboardSet(copyValue);
    if (result) {
      setShowCheckmark(true);
      setTimeout(() => setShowCheckmark(false), 2000);
    }
  };

  return (
    <button
      onClick={onClick}
      type="button"
      title="Copy"
      className={`flex items-center justify-center transition-all ${
        showCheckmark ? 'opacity-100' : 'opacity-50'
      } hover:opacity-70 active:opacity-90 ${classes}`}
    >
      {showCheckmark ? (
        <Image src={CheckmarkIcon} width={width} height={height} alt="" />
      ) : (
        <Image src={CopyIcon} width={width} height={height} alt="" />
      )}
    </button>
  );
}
