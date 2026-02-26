import ConfirmedIcon from '../../images/icons/confirmed-icon.svg';
import ErrorCircleIcon from '../../images/icons/error-circle.svg';
import { FinalTransferStatuses, SentTransferStatuses, TransferStatus } from './types';

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
  else if (status === TransferStatus.CreatingTxs) statusDescription = 'Creating transactions...';
  else if (status === TransferStatus.SigningApprove)
    statusDescription = `Sign approve transaction in ${connectorName} to continue.`;
  else if (status === TransferStatus.ConfirmingApprove)
    statusDescription = 'Confirming approve transaction...';
  else if (status === TransferStatus.SigningRevoke)
    statusDescription = `Sign revoke transaction in ${connectorName} to continue.`;
  else if (status === TransferStatus.ConfirmingRevoke)
    statusDescription = 'Confirming revoke transaction...';
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

export function isTransferSent(status: TransferStatus) {
  return SentTransferStatuses.includes(status);
}

export function isTransferFailed(status: TransferStatus) {
  return status === TransferStatus.Failed;
}

export const STATUSES_WITH_ICON = [
  TransferStatus.Delivered,
  TransferStatus.ConfirmedTransfer,
  TransferStatus.Failed,
];

export function getIconByTransferStatus(status: TransferStatus) {
  switch (status) {
    case TransferStatus.Delivered:
    case TransferStatus.ConfirmedTransfer:
      return ConfirmedIcon;
    case TransferStatus.Failed:
      return ErrorCircleIcon;
    default:
      return ErrorCircleIcon;
  }
}

import {
  ChainMap,
  CoreAddresses,
  MultiProtocolCore,
  MultiProtocolProvider,
  ProviderType,
  TypedTransactionReceipt,
  ViemProvider,
} from '@hyperlane-xyz/sdk';
import { isValidAddress, isValidAddressEvm } from '@hyperlane-xyz/utils';
import { getAddress } from 'viem';
import { logger } from '../../utils/logger';
import { getChainDisplayName } from '../chains/utils';

export function tryGetMsgIdFromTransferReceipt(
  multiProvider: MultiProtocolProvider,
  origin: ChainName,
  receipt: TypedTransactionReceipt,
) {
  try {
    // IBC transfers have no message IDs
    if (receipt.type === ProviderType.CosmJs) return undefined;

    if (receipt.type === ProviderType.Starknet) {
      receipt = {
        type: ProviderType.Starknet,
        receipt: receipt.receipt as any,
      };
    }

    if (receipt.type === ProviderType.Viem) {
      // Massage viem type into ethers type because that's still what the
      // SDK expects. In this case they're compatible.
      receipt = {
        type: ProviderType.EthersV5,
        receipt: receipt.receipt as any,
      };
    }

    const addressStubs = multiProvider
      .getKnownChainNames()
      .reduce<ChainMap<CoreAddresses>>((acc, chainName) => {
        // Actual core addresses not required for the id extraction
        acc[chainName] = {
          validatorAnnounce: '',
          proxyAdmin: '',
          mailbox: '',
        };
        return acc;
      }, {});
    const core = new MultiProtocolCore(multiProvider, addressStubs);
    const messages = core.extractMessageIds(origin, receipt);
    if (messages.length) {
      const msgId = messages[0].messageId;
      logger.debug('Message id found in logs', msgId);
      return msgId;
    } else {
      logger.warn('No messages found in logs');
      return undefined;
    }
  } catch (error) {
    logger.error('Could not get msgId from transfer receipt', error);
    return undefined;
  }
}

export async function isEvmContractAddress(
  viemProvider: ViemProvider['provider'],
  address: string,
): Promise<
  { isContractAddress: false; code: undefined } | { isContractAddress: true; code: string }
> {
  const code = await viemProvider.getCode({ address: getAddress(address) });
  if (!code || code === '0x') {
    return { isContractAddress: false, code: undefined };
  }
  return { isContractAddress: true, code };
}

const eip7702AccountSelector = '0xef0100';
export async function isSmartContract(
  multiProvider: MultiProtocolProvider,
  chain: string,
  address: string,
): Promise<{ isContract: boolean; error?: string }> {
  if (!isValidAddressEvm(address)) {
    return { isContract: false };
  }

  try {
    const provider = multiProvider.getViemProvider(chain);

    if (!provider) {
      throw new Error(`No viem provider for chain ${chain}`);
    }

    const { isContractAddress, code } = await isEvmContractAddress(provider, address);

    if (!isContractAddress && !code) return { isContract: false };

    // Checks if an address is also an EIP-7702 which is a smart account but not an smart contract
    // It would technically be correct to check if the delegated contract address is also a valid
    // contract address, but for our use case which is showing a banner to warn users
    // if the address is a Smart Contract, this wouldn't be necessary since `0xef0100`
    // is only reserved for Smart Accounts
    if (code.startsWith(eip7702AccountSelector)) return { isContract: false };

    return { isContract: true };
  } catch (error) {
    const msg = `Error checking if ${address} is a smart contract on ${getChainDisplayName(multiProvider, chain)}`;
    logger.error(msg, error);
    return { isContract: false, error: msg };
  }
}

// Returns if the recipient should be cleared by checking if it is valid address from the current chain protocol
export function shouldClearAddress(
  multiProvider: MultiProtocolProvider,
  recipient: string,
  chainName: string,
) {
  const protocol = multiProvider.tryGetProtocol(chainName);
  if (recipient && protocol && !isValidAddress(recipient, protocol)) return true;
  return false;
}
