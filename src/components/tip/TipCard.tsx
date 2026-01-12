import { Button, IconButton, XCircleIcon } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import { useState } from 'react';
import { config } from '../../consts/config';
import { useStore } from '../../features/store';
import ExternalIcon from '../../images/icons/external-link-icon.svg';
import { Card } from '../layout/Card';

export function TipCard() {
  const [show, setShow] = useState(config.showTipBox);
  const setIsTipCardActionTriggered = useStore((s) => s.setIsTipCardActionTriggered);
  if (!show) return null;
  return (
    <Card className="w-100 p-2 sm:w-[31rem]">
      <h2 className="text-primary-500">Bridge USDC</h2>
      <div className="flex items-end justify-between">
        <p className="mt-1 max-w-[75%] text-justify text-xs">
          Move between Solana, Base, Arbitrum, Optimism, Ethereum, Unichain, and more.
        </p>
        <Button
          className="ml-2 flex items-center rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-primary-500 transition-all hover:bg-gray-200 active:bg-gray-300 sm:text-sm"
          onClick={() => setIsTipCardActionTriggered(true)}
        >
          <Image src={ExternalIcon} width={12} alt="" />
          <span className="ml-1.5 hidden text-sm sm:inline">Bridge</span>
        </Button>
      </div>
      <div className="absolute right-3 top-3">
        <IconButton onClick={() => setShow(false)} title="Hide tip" className="hover:rotate-90">
          <XCircleIcon width={16} height={16} />
        </IconButton>
      </div>
    </Card>
  );
}
