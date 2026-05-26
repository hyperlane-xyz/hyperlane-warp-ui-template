import {
  ChainMap,
  ChainName,
  CoreAddresses,
  MultiProtocolCore,
  ProviderType,
  TypedTransactionReceipt,
  ViemProvider,
} from '@hyperlane-xyz/sdk';
import { ensure0x, isValidAddress, isValidAddressEvm } from '@hyperlane-xyz/utils';
import { concat, getAddress, keccak256, toHex } from 'viem';
import type { Hex } from 'viem';

import ConfirmedIcon from '../../images/icons/confirmed-icon.svg';
import ErrorCircleIcon from '../../images/icons/error-circle.svg';
import { logger } from '../../utils/logger';
import { getChainDisplayName } from '../chains/utils';
import { FinalTransferStatuses, SentTransferStatuses, TransferStatus } from './types';

type MultiProvider = MultiProtocolCore['multiProvider'];

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
  else if (status === TransferStatus.FetchingAttestation)
    statusDescription = 'Verifying compliance attestation...';
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

export async function tryGetMsgIdFromTransferReceipt(
  multiProvider: MultiProvider,
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
          quotedCalls: '',
        };
        return acc;
      }, {});
    const core = new MultiProtocolCore(multiProvider, addressStubs);
    const messages = await core.extractMessageIds(origin, receipt);
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

// keccak256("ReceivedTransferRemote(uint32,bytes32,uint256)")
// Computed once at module load; identifies the event emitted by the destination CCR router.
const RECEIVED_TRANSFER_REMOTE_TOPIC = keccak256(
  toHex('ReceivedTransferRemote(uint32,bytes32,uint256)'),
);

/**
 * For a same-chain CCR swap, compute the synthetic message ID the scraper stores.
 * Finds the ReceivedTransferRemote log emitted by destRouter and applies the formula:
 *
 *   msgId = 0x00000000 || keccak256("SameChainCCR" || txHash32 || logIndex8)[0..28]
 *
 * The 4-byte zero prefix makes synthetic IDs immediately distinguishable from real
 * Hyperlane message IDs (which are uniform keccak256 outputs).
 *
 * Returns undefined on ambiguity (more than one matching log).
 */
export function tryGetSameChainCcrMsgId(
  _multiProvider: MultiProvider,
  _chain: ChainName,
  _sourceRouter: string,
  destRouter: string,
  receipt: TypedTransactionReceipt,
): string | undefined {
  try {
    let logs: Array<{ address: string; topics: string[]; logIndex: number }>;
    let txHash: string;

    if (receipt.type === ProviderType.Viem || receipt.type === ProviderType.EthersV5) {
      const r = receipt.receipt as any;
      logs = r.logs ?? [];
      txHash = r.transactionHash ?? r.hash;
    } else {
      return undefined;
    }

    if (!txHash) return undefined;

    const destRouterLower = destRouter.toLowerCase();

    let matchedLog: (typeof logs)[0] | undefined;
    for (const log of logs) {
      if ((log.address ?? '').toLowerCase() !== destRouterLower) continue;
      if ((log.topics?.[0] ?? '').toLowerCase() !== RECEIVED_TRANSFER_REMOTE_TOPIC.toLowerCase())
        continue;

      if (matchedLog) {
        logger.warn('Ambiguous ReceivedTransferRemote logs for same-chain CCR swap');
        return undefined;
      }
      matchedLog = log;
    }

    if (!matchedLog) {
      logger.warn('No ReceivedTransferRemote log found for same-chain CCR swap');
      return undefined;
    }

    const logIndexBytes = toHex(BigInt(matchedLog.logIndex ?? 0), { size: 8 });
    const hash = keccak256(concat([toHex('SameChainCCR'), txHash as Hex, logIndexBytes]));

    // 4 zero bytes || first 28 bytes of hash
    const msgId = ensure0x('00'.repeat(4) + hash.slice(2, 58)) as Hex;
    logger.debug('Computed same-chain CCR msg ID', msgId);
    return msgId;
  } catch (error) {
    logger.error('Could not compute same-chain CCR msg ID', error);
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
  multiProvider: MultiProvider,
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

const VALIDATION_TIME_EST = 5; // seconds
const DEFAULT_BLOCK_TIME_EST = 3; // seconds
export const DEFAULT_FINALITY_BLOCKS = 3;

/**
 * Estimate total delivery time in seconds using chain metadata.
 * Returns null if metadata is unavailable.
 */
export function estimateDeliverySeconds(
  origin: ChainName,
  destination: ChainName,
  multiProvider: MultiProvider,
): number | null {
  try {
    const originMeta = multiProvider.tryGetChainMetadata(origin);
    const destMeta = multiProvider.tryGetChainMetadata(destination);
    if (!originMeta || !destMeta) return null;

    const originBlockTime = originMeta.blocks?.estimateBlockTime ?? DEFAULT_BLOCK_TIME_EST;
    const destBlockTime = destMeta.blocks?.estimateBlockTime ?? DEFAULT_BLOCK_TIME_EST;
    const confirmations = originMeta.blocks?.confirmations ?? DEFAULT_FINALITY_BLOCKS;

    // reorgPeriod can be a number or string block tag like "finalized"
    let reorgBlocks = 0;
    const reorgPeriod = originMeta.blocks?.reorgPeriod;
    if (typeof reorgPeriod === 'number') reorgBlocks = reorgPeriod;

    const finalityTime = (confirmations + reorgBlocks) * originBlockTime;
    const relayTime = destBlockTime * 1.5;

    return Math.ceil(finalityTime + VALIDATION_TIME_EST + relayTime);
  } catch (error) {
    logger.error('Failed to estimate delivery ETA', error);
    return null;
  }
}

/**
 * Format seconds into a human-readable ETA string.
 */
export function formatEta(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `~${minutes} min`;
}

// Returns if the recipient should be cleared by checking if it is valid address from the current chain protocol
export function shouldClearAddress(
  multiProvider: MultiProvider,
  recipient: string,
  chainName: string,
) {
  const protocol = multiProvider.tryGetProtocol(chainName);
  if (recipient && protocol && !isValidAddress(recipient, protocol)) return true;
  return false;
}
