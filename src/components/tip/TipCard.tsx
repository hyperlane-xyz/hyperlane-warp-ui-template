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
    <div className="bg-tip-card-gradient relative w-full overflow-hidden rounded px-4 pb-4 pt-4 shadow-card xl:w-72 xl:pb-24">
      <div className="absolute right-2 top-2">
        <IconButton
          onClick={() => setShow(false)}
          title="Hide tip"
          className="text-gray-400 hover:text-gray-600"
        >
          <XCircleIcon width={14} height={14} />
        </IconButton>
      </div>

      <h2 className="pr-6 font-secondary text-lg font-normal text-gray-900">
        Bridge Tokens with Hyperlane Warp Routes!
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        Warp Routes make it easy to permissionlessly take your tokens interchain. Fork this template
        to get started!
      </p>

      <a
        href={links.github}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
      >
        <Image src={InfoCircle} width={12} alt="" />
        <span>More</span>
      </a>

      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 opacity-50">
        <HyperlaneTransparentLogo />
      </div>
    </div>
  );
}
