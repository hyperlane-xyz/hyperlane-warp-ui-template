import Image from 'next/image';
import { useState } from 'react';

import { IconButton } from '../../components/buttons/IconButton';
import { config } from '../../consts/config';
import { links } from '../../consts/links';
import InfoCircle from '../../images/icons/info-circle.svg';
import XCircle from '../../images/icons/x-circle.svg';

export function TipCard() {
  const [show, setShow] = useState(config.showTipBox);
  if (!show) return null;
  return (
    <div className="relative px-3 py-3 w-100 sm:w-[31rem] bg-blue-500 shadow-lg rounded opacity-95">
      <h2 className="text-white sm:text-lg">Bridge Tokens with Hyperlane Warp Routes!</h2>
      <div className="flex items-end justify-between">
        <p className="text-white mt-1.5 text-xs sm:text-sm max-w-[70%]">
          Warp Routes make it easy to permisionlessly take your tokens interchain. Fork this
          template to get started!
        </p>
        <a
          href={links.github}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 px-3 py-1.5 flex items-center bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-xs sm:text-sm text-blue-500 rounded-md transition-all"
        >
          <Image src={InfoCircle} width={16} alt="" />
          <span className="ml-1.5">Learn More</span>
        </a>
      </div>
      <div className="absolute right-3 top-3 invert">
        <IconButton
          imgSrc={XCircle}
          onClick={() => setShow(false)}
          title="Hide tip"
          classes="hover:rotate-90"
        />
      </div>
    </div>
  );
}
