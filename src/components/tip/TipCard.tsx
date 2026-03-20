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
    <div className="tip-card relative w-full overflow-hidden rounded bg-tip-card-gradient px-4 pb-4 pt-4 shadow-card xl:w-72 xl:pb-24 dark:bg-[linear-gradient(0deg,rgba(154,13,255,0.3)_0%,rgba(17,17,17,0.95)_100%)] dark:shadow-[0_4px_6px_rgba(34,26,45,0.25),inset_0_0_0_1px_rgba(154,13,255,0.5)]">
      <div className="absolute right-2 top-2">
        <IconButton
          onClick={() => setShow(false)}
          title="Hide tip"
          className="text-gray-400 hover:text-gray-600 dark:text-[var(--dark-text-secondary)] dark:hover:text-[var(--dark-text-primary)] dark:[&_path]:fill-current"
        >
          <XCircleIcon width={14} height={14} />
        </IconButton>
      </div>

      <h2 className="pr-6 font-secondary text-lg font-normal text-gray-900 dark:text-white">
        Bridge Tokens with Hyperlane Warp Routes!
      </h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        Warp Routes make it easy to permissionlessly take your tokens interchain. Fork this template
        to get started!
      </p>

      <a
        href={links.github}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-secondary text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-primary-500/80 dark:bg-primary-500/20 dark:text-white dark:hover:bg-primary-500/30"
      >
        <Image src={InfoCircle} width={12} alt="" className="dark:invert" />
        <span>More</span>
      </a>

      <div className="tip-card-logo pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
        <HyperlaneTransparentLogo />
      </div>
    </div>
  );
}
