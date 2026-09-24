import { IconButton, XCircleIcon } from '@hyperlane-xyz/widgets';
import { useState } from 'react';

import { config } from '../../consts/config';
import { HyperlaneTransparentLogo } from '../icons/HyperlaneTransparentLogo';

export function TipCard() {
  const [show, setShow] = useState(config.showTipBox);
  if (!show) return null;
  return (
    <div
      data-testid="tip-card"
      className="tip-card relative w-full overflow-hidden rounded bg-tip-card-gradient px-4 pb-4 pt-4 shadow-card xl:w-72 xl:pb-24 dark:bg-gradient-to-t dark:from-primary-500/30 dark:to-[#111]/95 dark:shadow-lg dark:ring-1 dark:ring-inset dark:ring-primary-500/50"
    >
      <div className="absolute right-2 top-2">
        <IconButton
          onClick={() => setShow(false)}
          title="Hide tip"
          className="text-gray-400 hover:text-gray-600 dark:text-foreground-secondary dark:hover:text-foreground-primary dark:[&_path]:fill-current"
        >
          <XCircleIcon width={14} height={14} />
        </IconButton>
      </div>

      <h2 className="pr-6 font-secondary text-lg font-normal text-gray-900 dark:text-white">
        Hyperswaps are now live on Nexus!
      </h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-foreground-muted">
        Nexus now supports swaps on select chains, allowing you to move between tokens and chains in
        a single flow. Pick your send and receive tokens, and Nexus will handle the available route
        options from there.
      </p>

      <div className="tip-card-logo pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
        <HyperlaneTransparentLogo />
      </div>
    </div>
  );
}
