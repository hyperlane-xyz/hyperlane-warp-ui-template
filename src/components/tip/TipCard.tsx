import Image from 'next/image';
import { useState } from 'react';

import { IconButton } from '../../components/buttons/IconButton';
import { config } from '../../consts/config';
import { links } from '../../consts/links';
import InfoCircle from '../../images/icons/info-circle.svg';
import XCircle from '../../images/icons/x-circle.svg';
import { Card } from '../layout/Card';

export function TipCard() {
  const [show, setShow] = useState(config.showTipBox);
  if (!show) return null;
  return (
    <Card className="w-100 sm:w-[31rem] p-2">
      <h2 className="text-primary-500">Bridge Tokens with Hyperlane Warp Routes!</h2>
      <div className="flex items-end justify-between">
        <p className="mt-1 text-xs max-w-[75%]">
          Warp Routes make it easy to permissionlessly take your tokens interchain. Fork this
          template to get started!
        </p>
        <a
          href={links.github}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 px-3 py-1.5 flex items-center bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-xs sm:text-sm text-primary-500 rounded-lg transition-all"
        >
          <Image src={InfoCircle} width={12} alt="" />
          <span className="hidden sm:inline ml-1.5 text-sm">More</span>
        </a>
      </div>
      <div className="absolute right-3 top-3">
        <IconButton
          imgSrc={XCircle}
          onClick={() => setShow(false)}
          title="Hide tip"
          classes="hover:rotate-90"
        />
      </div>
    </Card>
  );
}
