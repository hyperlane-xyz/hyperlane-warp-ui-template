import { WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { Modal, Skeleton, Tooltip } from '@hyperlane-xyz/widgets';
import Link from 'next/link';
import { links } from '../../consts/links';

export function TransferFeeModal({
  isOpen,
  close,
  fees,
  isLoading,
}: {
  isOpen: boolean;
  close: () => void;
  fees: WarpCoreFeeEstimate | null;
  isLoading: boolean;
}) {
  return (
    <Modal
      title="Fee details"
      isOpen={isOpen}
      close={close}
      panelClassname="flex flex-col items-center p-4 gap-5"
      showCloseButton
    >
      <div className="flex w-full flex-col items-start gap-2 text-sm">
        {fees?.localQuote && fees.localQuote.amount > 0n && (
          <div className="flex gap-4">
            <span className="flex min-w-[7.5rem] items-center gap-1">
              Local Gas (est.)
              <Tooltip
                content="Gas to submit the transaction on the origin chain"
                id="local-gas-tooltip"
              />
            </span>
            {isLoading ? (
              <Skeleton className="h-4 w-52" />
            ) : (
              <span>{`${fees.localQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${
                fees.localQuote.token.symbol || ''
              }`}</span>
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
              />
            </span>
            {isLoading ? (
              <Skeleton className="h-4 w-52" />
            ) : (
              <span>{`${fees.interchainQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${
                fees.interchainQuote.token.symbol || ''
              }`}</span>
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
