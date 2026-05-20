import {
  ChainMap,
  CoreAddresses,
  MultiProtocolCore,
  ProviderType,
  TypedTransactionReceipt,
  ViemProvider,
} from '@hyperlane-xyz/sdk';
import { isValidAddress, isValidAddressEvm } from '@hyperlane-xyz/utils';
import { concat, getAddress, keccak256, pad, toHex } from 'viem';
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

export function tryGetMsgIdFromTransferReceipt(
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

// keccak256("ReceivedTransferRemote(uint32,bytes32,uint256)")
// Computed once at module load; identifies the event emitted by the destination CCR router.
const RECEIVED_TRANSFER_REMOTE_TOPIC = keccak256(
  toHex('ReceivedTransferRemote(uint32,bytes32,uint256)'),
);

/**
 * For a same-chain CCR swap, compute the synthetic Hyperlane message ID the
 * scraper stores. Finds the ReceivedTransferRemote log emitted by destRouter
 * and applies the same deterministic formula as the scraper:
 *   nonce = keccak256(zeroPad(txHash,64) || toBE(logIndex,8))[0:4] % 2^31
 *   body  = recipient_bytes32 || amountReceived_uint256
 *   msgId = keccak256(version=3 || nonce || domain || srcRouter32 || domain || dstRouter32 || body)
 */
export function tryGetSameChainCcrMsgId(
  multiProvider: MultiProvider,
  chain: ChainName,
  sourceRouter: string,
  destRouter: string,
  receipt: TypedTransactionReceipt,
): string | undefined {
  try {
    let logs: Array<{ address: string; topics: string[]; data: string; logIndex: number }>;
    let txHash: string;

    if (receipt.type === ProviderType.Viem || receipt.type === ProviderType.EthersV5) {
      const r = receipt.receipt as any;
      logs = r.logs ?? [];
      txHash = r.transactionHash ?? r.hash;
    } else {
      return undefined;
    }

    if (!txHash) return undefined;

    const domainId = multiProvider.getDomainId(chain);
    const destRouterLower = destRouter.toLowerCase();

    for (const log of logs) {
      if ((log.address ?? '').toLowerCase() !== destRouterLower) continue;
      if ((log.topics?.[0] ?? '').toLowerCase() !== RECEIVED_TRANSFER_REMOTE_TOPIC.toLowerCase())
        continue;

      // topic2 = recipient (bytes32, indexed)
      const recipientBytes32 = log.topics[2] as Hex;
      // data = amount received (uint256, 32 bytes ABI-encoded)
      const amountReceived = BigInt(log.data || '0x0');
      const logIndex = BigInt(log.logIndex ?? 0);

      // 1. Nonce: keccak256(zeroPad(txHash,64) || toBE(logIndex,8))[0:4] % 2^31
      const txHashPadded = pad(txHash as Hex, { size: 64, dir: 'left' });
      const logIndexBytes = toHex(logIndex, { size: 8 });
      const nonceHash = keccak256(concat([txHashPadded, logIndexBytes]));
      const nonce = Number(BigInt(nonceHash.slice(0, 10)) % 2_147_483_648n);

      // 2. TokenMessage body: recipient_bytes32 || amountReceived_uint256
      const amountBytes = toHex(amountReceived, { size: 32 });
      const body = concat([recipientBytes32, amountBytes]);

      // 3. Encode Hyperlane message (version=3, origin==destination==domain)
      const sourceBytes32 = pad(sourceRouter as Hex, { size: 32, dir: 'left' });
      const destBytes32 = pad(destRouter as Hex, { size: 32, dir: 'left' });
      const encoded = concat([
        toHex(3, { size: 1 }),        // version
        toHex(nonce, { size: 4 }),    // nonce
        toHex(domainId, { size: 4 }), // origin
        sourceBytes32,                // sender (source CCR router)
        toHex(domainId, { size: 4 }), // destination (same chain)
        destBytes32,                  // recipient (dest CCR router)
        body,
      ]);

      const msgId = keccak256(encoded);
      logger.debug('Computed same-chain CCR msg ID', msgId);
      return msgId;
    }

    logger.warn('No ReceivedTransferRemote log found for same-chain CCR swap');
    return undefined;
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
