import { WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { Modal, Skeleton } from '@hyperlane-xyz/widgets';

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
  // if (!fees) return null;
  return (
    <Modal
      title="Fee details"
      isOpen={isOpen}
      close={close}
      panelClassname="flex flex-col items-center p-4 gap-5"
      showCloseButton
    >
      <div className="flex w-full flex-col items-start text-sm">
        {fees?.localQuote && fees.localQuote.amount > 0n && (
          <p className="flex gap-4">
            <span className="min-w-[7.5rem]">Local Gas (est.)</span>
            {isLoading ? (
              <Skeleton className="h-4 w-52" />
            ) : (
              <span>{`${fees.localQuote.getDecimalFormattedAmount().toFixed(4) || '0'} ${
                fees.localQuote.token.symbol || ''
              }`}</span>
            )}
          </p>
        )}
        {fees?.interchainQuote && fees.interchainQuote.amount > 0n && (
          <p className="flex gap-4">
            <span className="min-w-[7.5rem]">Interchain Gas</span>
            {isLoading ? (
              <Skeleton className="h-4 w-52" />
            ) : (
              <span>{`${fees.interchainQuote.getDecimalFormattedAmount().toFixed(4) || '0'} ${
                fees.interchainQuote.token.symbol || ''
              }`}</span>
            )}
          </p>
        )}
        {fees?.tokenFeeQuote && fees.tokenFeeQuote.amount > 0n && (
          <p className="flex gap-4">
            <span className="min-w-[7.5rem]">Token Fee</span>
            {isLoading ? (
              <Skeleton className="h-4 w-52" />
            ) : (
              <span>{`${fees.tokenFeeQuote.getDecimalFormattedAmount().toFixed(4) || '0'} ${
                fees.tokenFeeQuote.token.symbol || ''
              }`}</span>
            )}
          </p>
        )}
      </div>
    </Modal>
  );
}
