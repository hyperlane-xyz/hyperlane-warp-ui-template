import { IconButton, XCircleIcon } from '@hyperlane-xyz/widgets';
import { useState } from 'react';
import { config } from '../../consts/config';
import { Card } from '../layout/Card';

export function TipCard() {
  const [show, setShow] = useState(config.showTipBox);
  if (!show) return null;
  return (
    <Card className="w-100 p-2 sm:w-[31rem]">
      <h2 className="text-primary-500">Update for inEVM/injective route</h2>
      <div className="flex items-end justify-between">
        <p className="mt-1 max-w-[75%] text-xs">
          Bridging INJ between inEVM and Injective is temporarily disabled while the team
          investigates an ongoing issue.
        </p>
      </div>
      <div className="absolute right-3 top-3">
        <IconButton onClick={() => setShow(false)} title="Hide tip" className="hover:rotate-90">
          <XCircleIcon width={16} height={16} />
        </IconButton>
      </div>
    </Card>
  );
}
