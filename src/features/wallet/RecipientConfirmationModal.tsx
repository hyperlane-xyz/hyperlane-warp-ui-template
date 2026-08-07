import { Modal } from '@hyperlane-xyz/widgets';

import { SolidButton } from '../../components/buttons/SolidButton';

interface Props {
  isOpen: boolean;
  close: () => void;
  onConfirm: () => void;
  recipient: string;
  /** "destination" if unknown */
  destinationChainDisplay?: string;
}

// "Recipient address has no funds — continue?" guard. Presentational only;
// callers resolve recipient + chain display from their own form state.
export function RecipientConfirmationModal({
  isOpen,
  close,
  onConfirm,
  recipient,
  destinationChainDisplay,
}: Props) {
  const dst = destinationChainDisplay || 'the destination chain';
  return (
    <Modal
      isOpen={isOpen}
      close={close}
      title="Confirm Recipient Address"
      panelClassname="flex flex-col items-center p-4 gap-5"
    >
      <p className="text-center text-sm">
        The recipient address has no funds on {dst}. Is this address correct?
      </p>
      <p className="rounded-lg bg-primary-500/5 p-2 text-center text-sm">{recipient}</p>
      <div className="flex items-center justify-center gap-12">
        <SolidButton onClick={close} color="gray" className="min-w-24 px-4 py-1">
          Cancel
        </SolidButton>
        <SolidButton
          onClick={() => {
            close();
            onConfirm();
          }}
          color="primary"
          className="min-w-24 px-4 py-1"
        >
          Continue
        </SolidButton>
      </div>
    </Modal>
  );
}
