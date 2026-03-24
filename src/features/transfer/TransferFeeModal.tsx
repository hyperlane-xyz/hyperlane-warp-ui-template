import { WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { Modal, Skeleton, Tooltip } from '@hyperlane-xyz/widgets';
import Link from 'next/link';
import { links } from '../../consts/links';
import { UsdLabel } from '../balances/UsdLabel';
import { FeePrices } from '../balances/useFeePrices';

export function TransferFeeModal({
  isOpen,
  close,
  fees,
  isLoading,
  feePrices,
}: {
  isOpen: boolean;
  close: () => void;
  fees: WarpCoreFeeEstimate | null;
  isLoading: boolean;
  feePrices: FeePrices;
}) {
  return (
    <Modal
      isOpen={isOpen}
      close={close}
      panelClassname="transfer-fee-modal p-0 max-w-sm md:max-w-128 overflow-hidden"
    >
      <div className="w-full bg-accent-gradient px-4 py-2.5 font-secondary text-base font-normal tracking-wider text-white shadow-accent-glow">
        Fee Details
      </div>
      <div className="transfer-fee-modal-content flex w-full flex-col items-start gap-2 p-4 text-sm">
        {fees?.localQuote && fees.localQuote.amount > 0n && (
          <div className="flex gap-4">
            <span className="flex min-w-[7.5rem] items-center gap-1">
              Local Gas (est.)
              <Tooltip
                content="Gas to submit the transaction on the origin chain"
                id="local-gas-tooltip"
                tooltipClassName="max-w-[300px]"
              />
            </span>
            {isLoading ? (
              <Skeleton className="h-4 w-40 sm:w-72" />
            ) : (
              <span>
                {`${fees.localQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${fees.localQuote.token.symbol || ''}`}
                <UsdLabel tokenAmount={fees.localQuote} feePrices={feePrices} />
              </span>
            )}
          </div>
        )}
        {fees?.interchainQuote && fees.interchainQuote.amount > 0n && (
          <div className="flex gap-4">
            <span className="flex min-w-[7.5rem] items-center gap-1">
              Interchain Gas
              <Tooltip
                content="Gas to deliver and execute the message on the destination chain, including the relayer fee"
                id="igp-tooltip"
                tooltipClassName="max-w-[300px]"
              />
            </span>
            {isLoading ? (
              <Skeleton className="h-4 w-40 sm:w-72" />
            ) : (
              <span>
                {`${fees.interchainQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${fees.interchainQuote.token.symbol || ''}`}
                <UsdLabel tokenAmount={fees.interchainQuote} feePrices={feePrices} />
              </span>
            )}
          </div>
        )}
        {fees?.tokenFeeQuote && fees.tokenFeeQuote.amount > 0n && (
          <div className="flex gap-4">
            <span className="flex min-w-[7.5rem] items-center gap-1">
              Token Fee <Tooltip content="Variable fee based on amount" id="token-fee-tooltip" />
            </span>
            {isLoading ? (
              <Skeleton className="h-4 w-40 sm:w-72" />
            ) : (
              <span>
                {`${fees.tokenFeeQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${fees.tokenFeeQuote.token.symbol || ''}`}
                <UsdLabel tokenAmount={fees.tokenFeeQuote} feePrices={feePrices} />
              </span>
            )}
          </div>
        )}
        <span className="mt-2">
          Read more about{' '}
          <Link
            href={links.transferFees}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-500 underline"
          >
            transfer fees.
          </Link>
        </span>
      </div>
    </Modal>
  );
}
