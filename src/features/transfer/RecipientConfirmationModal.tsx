import { getAccountAddressAndPubKey, Modal, useAccounts } from '@hyperlane-xyz/widgets';
import { useFormikContext } from 'formik';
import { SolidButton } from '../../components/buttons/SolidButton';
import { useMultiProvider } from '../chains/hooks';
import { getTokenByKey, useTokens } from '../tokens/hooks';
import { TransferFormValues } from './types';

export function RecipientConfirmationModal({
  isOpen,
  close,
  onConfirm,
}: {
  isOpen: boolean;
  close: () => void;
  onConfirm: () => void;
}) {
  const { values } = useFormikContext<TransferFormValues>();
  const multiProvider = useMultiProvider();
  const tokens = useTokens();
  const { accounts } = useAccounts(multiProvider);
  const destinationToken = getTokenByKey(tokens, values.destinationTokenKey);

  // Get recipient (form value or fallback to connected wallet for destination)
  const { address: connectedDestAddress } = getAccountAddressAndPubKey(
    multiProvider,
    destinationToken?.chainName,
    accounts,
  );
  const recipient = values.recipient || connectedDestAddress || '';

  return (
    <Modal
      isOpen={isOpen}
      close={close}
      title="Confirm Recipient Address"
      panelClassname="flex flex-col items-center p-4 gap-5"
    >
      <p className="text-center text-sm">
        The recipient address has no funds on the destination chain. Is this address correct?
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
