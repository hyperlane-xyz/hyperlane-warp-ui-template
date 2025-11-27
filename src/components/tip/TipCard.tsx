import { XIcon } from '@hyperlane-xyz/widgets';
import { useState } from 'react';
import { config } from '../../consts/config';
import { Card } from '../layout/Card';

export function TipCard() {
  const [show, setShow] = useState(config.showTipBox);
  if (!show) return null;
  return (
    <Card className="relative w-100 bg-[#d4cafe] p-4 sm:w-[31rem]">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold leading-[18px] text-[#202020]">
            Bridge USDC with zero slippage
          </h2>
          <p className="text-sm font-medium leading-[18px] text-[rgba(0,0,0,0.49)]">
            Move between Solana, Base, Arbitrum, Optimism, Ethereum, Unichain, and more.
          </p>
        </div>
        <button className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-[#f2e2fc] px-2 text-sm font-semibold text-[#6550b9] transition-colors hover:bg-[#e8d5f9]">
          Bridge
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 8L12 8M12 8L9 5M12 8L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <button
        onClick={() => setShow(false)}
        className="absolute right-4 top-4 transition-transform hover:rotate-90"
        title="Close"
      >
        <XIcon width={16} height={16} color="#202020" />
      </button>
    </Card>
  );
}
