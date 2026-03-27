import { Button, IconButton, XCircleIcon } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useState } from 'react';

import { config } from '../../consts/config';
import { useStore } from '../../features/store';
import SendIcon from '../../images/icons/send-icon.svg';
import { HyperlaneTransparentLogo } from '../icons/HyperlaneTransparentLogo';

export function TipCard() {
  const [show, setShow] = useState(config.showTipBox);
  const setIsTipCardActionTriggered = useStore((s) => s.setIsTipCardActionTriggered);
  if (!show) return null;
  return (
<<<<<<< HEAD
    <div className="tip-card relative w-full overflow-hidden rounded bg-tip-card-gradient px-4 pb-4 pt-4 shadow-card xl:w-72 xl:pb-24">
=======
    <div className="tip-card relative w-full overflow-hidden rounded bg-tip-card-gradient px-4 pb-4 pt-4 shadow-card xl:w-72 xl:pb-24 dark:bg-gradient-to-t dark:from-primary-500/30 dark:to-[#111]/95 dark:shadow-lg dark:ring-1 dark:ring-inset dark:ring-primary-500/50">
>>>>>>> origin/main
      <div className="absolute right-2 top-2">
        <IconButton
          onClick={() => setShow(false)}
          title="Hide tip"
<<<<<<< HEAD
          className="tip-card-close text-gray-400 hover:text-gray-600"
=======
          className="text-gray-400 hover:text-gray-600 dark:text-foreground-secondary dark:hover:text-foreground-primary dark:[&_path]:fill-current"
>>>>>>> origin/main
        >
          <XCircleIcon width={14} height={14} />
        </IconButton>
      </div>

<<<<<<< HEAD
      <h2 className="tip-card-title pr-6 font-secondary text-lg font-normal text-gray-900">
        Bridge ETH
      </h2>
      <p className="tip-card-copy mt-2 text-sm text-gray-600">
        Bridge and get real ETH in seconds, no unwrapping needed. Starting with Arbitrum, Base,
        Ethereum, Optimism.
      </p>

      <Button
        className="tip-card-more mt-3 inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-secondary text-sm text-gray-700 transition-colors hover:bg-gray-50"
        onClick={() => setIsTipCardActionTriggered(true)}
      >
        <span>Bridge</span>
        <Image src={SendIcon} width={16} alt="" className="tip-card-more-icon" />
      </Button>
=======
      <h2 className="pr-6 font-secondary text-lg font-normal text-gray-900 dark:text-white">
        Bridge Tokens with Hyperlane Warp Routes!
      </h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-foreground-muted">
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
>>>>>>> origin/main

      <div className="tip-card-logo pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
        <HyperlaneTransparentLogo />
      </div>
    </div>
  );
}
