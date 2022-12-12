import { Modal } from '../layout/Modal';

export function TokenSelectModal({
  isOpen,
  close,
  onSelect,
}: {
  isOpen: boolean;
  close: () => void;
  onSelect: (tokenAddress: Address) => void;
}) {
  return (
    <Modal isOpen={isOpen} title="Select Token" close={close}>
      <div className="mt-1 flex">TODO</div>
    </Modal>
  );
}
