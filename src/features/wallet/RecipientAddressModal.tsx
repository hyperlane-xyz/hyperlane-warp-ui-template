import { isValidAddress, ProtocolType } from '@hyperlane-xyz/utils';
import { Modal, XIcon } from '@hyperlane-xyz/widgets';
import { useState } from 'react';
import { SolidButton } from '../../components/buttons/SolidButton';

interface RecipientAddressModalProps {
  isOpen: boolean;
  close: () => void;
  onSave: (address: string) => void;
  initialValue?: string;
  protocol?: ProtocolType;
}

export function RecipientAddressModal({
  isOpen,
  close,
  onSave,
  initialValue = '',
  protocol = ProtocolType.Ethereum,
}: RecipientAddressModalProps) {
  const [address, setAddress] = useState(initialValue);
  const [error, setError] = useState('');

  const handleSave = () => {
    const trimmedAddress = address.trim();
    if (!trimmedAddress) return;

    if (!isValidAddress(trimmedAddress, protocol)) {
      setError('Invalid address');
      return;
    }

    setError('');
    onSave(trimmedAddress);
    close();
  };

  const handleClose = () => {
    setAddress(initialValue);
    setError('');
    close();
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
    if (error) setError('');
  };

  return (
    <Modal isOpen={isOpen} close={handleClose} panelClassname="max-w-sm p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-medium text-gray-900">Receive Address</h2>
        <button
          type="button"
          onClick={handleClose}
          className="text-gray-400 transition-colors hover:text-gray-600"
        >
          <XIcon width={12} height={12} />
        </button>
      </div>
      <div className="px-4 pb-4">
        <input
          type="text"
          value={address}
          onChange={handleAddressChange}
          placeholder="Paste Address or ENS"
          className={`w-full rounded-lg border px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none ${
            error
              ? 'border-red-500 focus:border-red-500'
              : 'border-gray-300 focus:border-primary-500'
          }`}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        <SolidButton
          type="button"
          color="primary"
          onClick={handleSave}
          className="mt-4 w-full py-3 text-base"
          disabled={!address.trim()}
        >
          Save
        </SolidButton>
      </div>
    </Modal>
  );
}
