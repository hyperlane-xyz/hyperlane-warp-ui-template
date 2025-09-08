import { WarpCoreFeeEstimate } from '@hyperlane-xyz/sdk';
import { Modal, Skeleton, Tooltip } from '@hyperlane-xyz/widgets';

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
      <div className="flex w-full flex-col items-start gap-2 text-sm">
        {fees?.localQuote && fees.localQuote.amount > 0n && (
          <div className="flex gap-4">
            <span className="flex min-w-[7.5rem] items-center gap-1">
              Local Gas (est.)
              <Tooltip content="Fee paid to the network" id="local-gas-tooltip" />
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
              <Tooltip content="Interchain Gas paid to the contract" id="igp-tooltip" />
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
        {fees?.tokenFeeQuote && fees.tokenFeeQuote.amount > 0n && (
          <div className="flex gap-4">
            <span className="flex min-w-[7.5rem] items-center gap-1">
              Token Fee <Tooltip content="Variable fee based on amount" id="token-fee-tooltip" />
            </span>
            {isLoading ? (
              <Skeleton className="h-4 w-52" />
            ) : (
              <span>{`${fees.tokenFeeQuote.getDecimalFormattedAmount().toFixed(8) || '0'} ${
                fees.tokenFeeQuote.token.symbol || ''
              }`}</span>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
