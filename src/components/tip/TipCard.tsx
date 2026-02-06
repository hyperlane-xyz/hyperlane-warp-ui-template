import { IconButton, XCircleIcon } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useState } from 'react';
import { config } from '../../consts/config';
import { links } from '../../consts/links';
import InfoCircle from '../../images/icons/info-circle.svg';
import { HyperlaneTransparentLogo } from '../icons/HyperlaneTransparentLogo';

export function TipCard() {
  const [show, setShow] = useState(config.showTipBox);
  if (!show) return null;
  return (
    <div className="relative w-100 overflow-hidden rounded bg-tip-card-gradient px-3 pb-3 pt-3 shadow-card sm:w-[31rem] sm:px-4 sm:pb-4 sm:pt-4">
      <div className="absolute right-2 top-2">
        <IconButton
          onClick={() => setShow(false)}
          title="Hide tip"
          className="text-gray-400 hover:text-gray-600"
        >
          <XCircleIcon width={14} height={14} />
        </IconButton>
      </div>

      <h2 className="pr-6 font-secondary text-sm font-normal text-gray-900 sm:text-lg">
        Bridge Tokens with Hyperlane Warp Routes!
      </h2>
      <p className="mt-1 text-xs text-gray-600 sm:mt-2 sm:text-sm">
        Warp Routes make it easy to permissionlessly take your tokens interchain. Fork this template
        to get started!
      </p>

      <a
        href={links.github}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2 py-1 font-secondary text-xs text-gray-700 transition-colors hover:bg-gray-50 sm:mt-3 sm:px-3 sm:py-1.5 sm:text-sm"
      >
        <Image src={InfoCircle} width={12} alt="" />
        <span>More</span>
      </a>

      <div className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-40">
        <HyperlaneTransparentLogo />
      </div>
    </div>
  );
}
