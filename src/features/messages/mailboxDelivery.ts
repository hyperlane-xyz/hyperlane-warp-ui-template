import type { ChainAddresses } from '@hyperlane-xyz/registry';
import type { ChainMap, ChainName, MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import {
  decodeFunctionResult,
  encodeFunctionData,
  parseAbi,
  toEventSelector,
  type Hex,
} from 'viem';

import { logger } from '../../utils/logger';

const MAILBOX_ABI = parseAbi([
  // Mirrors the stable Hyperlane Mailbox delivery surface used by the SDK.
  'function delivered(bytes32) view returns (bool)',
  'function processedAt(bytes32) view returns (uint256)',
  'event ProcessId(bytes32 indexed messageId)',
]);
const MAILBOX_PROCESS_ID_TOPIC = toEventSelector('ProcessId(bytes32)');

type EthersLikeProvider = {
  call: (tx: { to: string; data: string }) => Promise<string>;
  getLogs: (filter: {
    address: string;
    fromBlock: number;
    toBlock: number;
    topics: string[];
  }) => Promise<Array<{ transactionHash?: string }>>;
};

export async function getMailboxDeliveryStatus({
  msgId,
  destinationChain,
  chainAddresses,
  multiProvider,
}: {
  msgId: string;
  destinationChain: ChainName;
  chainAddresses: ChainMap<ChainAddresses>;
  multiProvider: MultiProtocolProvider;
}) {
  try {
    const protocol = multiProvider.tryGetProtocol(destinationChain);
    if (protocol !== ProtocolType.Ethereum && protocol !== ProtocolType.Tron) {
      return { isDelivered: false, destinationTxHash: undefined };
    }

    const mailbox = chainAddresses[destinationChain]?.mailbox;
    if (!mailbox) return { isDelivered: false, destinationTxHash: undefined };

    const typedProvider = multiProvider.getProvider(destinationChain);
    if (typedProvider.type !== 'ethers-v5' && typedProvider.type !== 'tron') {
      return { isDelivered: false, destinationTxHash: undefined };
    }
    const provider = typedProvider.provider as EthersLikeProvider;
    const delivered = await callMailboxBoolean(provider, mailbox, 'delivered', msgId);
    if (!delivered) return { isDelivered: false, destinationTxHash: undefined };

    let destinationTxHash: string | undefined;
    try {
      const processedAt = await callMailboxUint(provider, mailbox, 'processedAt', msgId);
      const processedBlock = mailboxProcessedBlockToNumber(processedAt);
      destinationTxHash = processedBlock
        ? await findProcessTxHash(provider, mailbox, msgId, processedBlock)
        : undefined;
    } catch (err) {
      logger.warn('Mailbox delivered but process transaction lookup failed', err as Error);
    }

    return { isDelivered: true, destinationTxHash };
  } catch (err) {
    logger.warn('Fast mailbox delivery check failed', err as Error);
    return { isDelivered: false, destinationTxHash: undefined };
  }
}

async function callMailboxBoolean(
  provider: EthersLikeProvider,
  mailbox: string,
  functionName: 'delivered',
  msgId: string,
) {
  const raw = await provider.call({
    to: mailbox,
    data: encodeMailboxCall(functionName, msgId),
  });
  return decodeFunctionResult({
    abi: MAILBOX_ABI,
    functionName,
    data: raw as Hex,
  });
}

async function callMailboxUint(
  provider: EthersLikeProvider,
  mailbox: string,
  functionName: 'processedAt',
  msgId: string,
) {
  const raw = await provider.call({
    to: mailbox,
    data: encodeMailboxCall(functionName, msgId),
  });
  return decodeFunctionResult({
    abi: MAILBOX_ABI,
    functionName,
    data: raw as Hex,
  });
}

async function findProcessTxHash(
  provider: EthersLikeProvider,
  mailbox: string,
  msgId: string,
  blockNumber: number,
) {
  const [log] = await provider.getLogs({
    address: mailbox,
    fromBlock: blockNumber,
    toBlock: blockNumber,
    topics: [MAILBOX_PROCESS_ID_TOPIC, msgId],
  });
  return log?.transactionHash;
}

function encodeMailboxCall(functionName: 'delivered' | 'processedAt', msgId: string) {
  return encodeFunctionData({
    abi: MAILBOX_ABI,
    functionName,
    args: [msgId as Hex],
  });
}

function mailboxProcessedBlockToNumber(processedAt: bigint | number) {
  const processedBlock = BigInt(processedAt);
  if (processedBlock <= 0n || processedBlock > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  return Number(processedBlock);
}
