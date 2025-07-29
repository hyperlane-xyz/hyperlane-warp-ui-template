import { IconButton, XCircleIcon } from '@hyperlane-xyz/widgets';
import { useState } from 'react';
import { config } from '../../consts/config';
import { Card } from '../layout/Card';

export function TipCard() {
  const [show, setShow] = useState(config.showTipBox);
  if (!show) return null;
  return (
    <Card className="w-100 p-2 sm:w-[31rem]">
      <h2 className="text-primary-500">
        Pruv Bridge: A Secure Gateway for Moving Digital Assets Across the Pruv Ecosystem
      </h2>
      <div className="flex items-end justify-between">
        <div className="mt-1 max-w-[75%] text-xs">
          <p className="mb-1">To bridge your assets, follow these simple steps:</p>
          <ul className="list-inside list-disc">
            <li>Select the origin and destination chain</li>
            <li>Pick the token you want to transfer</li>
            <li>Enter the amount</li>
            <li>
              Click <strong>Continue</strong>, then verify and sign with your wallet
            </li>
          </ul>
        </div>
      </div>
      <div className="absolute right-3 top-3">
        <IconButton onClick={() => setShow(false)} title="Hide tip" className="hover:rotate-90">
          <XCircleIcon width={16} height={16} />
        </IconButton>
      </div>
    </Card>
  );
}
