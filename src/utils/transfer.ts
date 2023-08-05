import { FinalTransferStatuses, TransferStatus } from '../features/transfer/types';

export function getTransferStatusLabel(
  status: TransferStatus,
  connectorName: string,
  isPermissionlessRoute: boolean,
  isAccountReady: boolean,
) {
  let statusDescription = '...';
  if (!isAccountReady && !FinalTransferStatuses.includes(status))
    statusDescription = 'Please connect wallet to continue';
  else if (status === TransferStatus.Preparing)
    statusDescription = 'Preparing for token transfer...';
  else if (status === TransferStatus.CreatingApprove)
    statusDescription = 'Preparing approve transaction...';
  else if (status === TransferStatus.SigningApprove)
    statusDescription = `Sign approve transaction in ${connectorName} to continue.`;
  else if (status === TransferStatus.ConfirmingApprove)
    statusDescription = 'Confirming approve transaction...';
  else if (status === TransferStatus.CreatingTransfer)
    statusDescription = 'Preparing transfer transaction...';
  else if (status === TransferStatus.SigningTransfer)
    statusDescription = `Sign transfer transaction in ${connectorName} to continue.`;
  else if (status === TransferStatus.ConfirmingTransfer)
    statusDescription = 'Confirming transfer transaction...';
  else if (status === TransferStatus.ConfirmedTransfer)
    if (!isPermissionlessRoute)
      statusDescription = 'Transfer transaction confirmed, delivering message...';
    else
      statusDescription =
        'Transfer confirmed, the funds will arrive when the message is delivered.';
  else if (status === TransferStatus.Delivered)
    statusDescription = 'Delivery complete, transfer successful!';
  else if (status === TransferStatus.Failed)
    statusDescription = 'Transfer failed, please try again.';

  return statusDescription;
}
