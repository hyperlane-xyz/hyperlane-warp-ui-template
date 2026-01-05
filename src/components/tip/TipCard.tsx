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
    <div className="relative w-full overflow-hidden rounded border border-accent-500/50 bg-gradient-to-t from-accent-500/30 to-gray-900/95 px-4 pb-4 pt-4 shadow-card xl:w-72 xl:pb-24">
      <div className="absolute right-2 top-2">
        <IconButton
          onClick={() => setShow(false)}
          title="Hide tip"
          className="text-gray-400 hover:text-gray-200"
        >
          <XCircleIcon width={14} height={14} />
        </IconButton>
      </div>

      <h2 className="pr-6 font-secondary text-lg font-normal text-white">
        Bridge Tokens with Hyperlane Warp Routes!
      </h2>
      <p className="mt-2 text-sm text-gray-300">
        Warp Routes make it easy to permissionlessly take your tokens interchain. Fork this template
        to get started!
      </p>

      <a
        href={links.github}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-accent-500 bg-accent-500/20 px-3 py-1.5 font-secondary text-sm text-white transition-colors hover:bg-accent-500/30"
      >
        <Image src={InfoCircle} width={12} alt="" className="invert" />
        <span>More</span>
      </a>

      <div
        className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center"
        style={{
          maskImage: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 80%)',
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 80%)',
        }}
      >
        <HyperlaneTransparentLogo />
      </div>
    </div>
  );
}
