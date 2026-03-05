import { IconButton, XCircleIcon } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useState } from 'react';
import { config } from '../../consts/config';
<<<<<<< HEAD
import ExternalIcon from '../../images/icons/external-link-icon.svg';
import { Card } from '../layout/Card';
=======
import { links } from '../../consts/links';
import InfoCircle from '../../images/icons/info-circle.svg';
import { HyperlaneTransparentLogo } from '../icons/HyperlaneTransparentLogo';
>>>>>>> origin/main

export function TipCard() {
  const [show, setShow] = useState(config.showTipBox);
  if (!show) return null;
  return (
<<<<<<< HEAD
    <Card className="w-100 p-2 sm:w-[31rem]">
      <h2 className="text-primary-500">inEVM Deprecation Notice</h2>
      <div className="flex items-end justify-between">
        <p className="mt-1 max-w-[75%] text-xs">
          inEVM has been deprecated. Please visit the Injective Bridge UI for bridging to Injective
          Mainnet EVM.
        </p>
        <a
          href="https://bridge.injective.network/"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 flex items-center rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-primary-500 transition-all hover:bg-gray-200 active:bg-gray-300 sm:text-sm"
        >
          <Image src={ExternalIcon} width={12} alt="" />
          <span className="ml-1.5 hidden text-sm sm:inline">Visit</span>
        </a>
      </div>
      <div className="absolute right-3 top-3">
        <IconButton onClick={() => setShow(false)} title="Hide tip" className="hover:rotate-90">
          <XCircleIcon width={16} height={16} />
=======
    <div className="relative w-full overflow-hidden rounded bg-tip-card-gradient px-4 pb-4 pt-4 shadow-card xl:w-72 xl:pb-24">
      <div className="absolute right-2 top-2">
        <IconButton
          onClick={() => setShow(false)}
          title="Hide tip"
          className="text-gray-400 hover:text-gray-600"
        >
          <XCircleIcon width={14} height={14} />
>>>>>>> origin/main
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
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-secondary text-sm text-gray-700 transition-colors hover:bg-gray-50"
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
