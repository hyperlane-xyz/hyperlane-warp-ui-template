import {
  ChainMap,
  CoreAddresses,
  MultiProtocolCore,
  ProviderType,
  TypedTransactionReceipt,
} from '@hyperlane-xyz/sdk';

import { getMultiProvider } from '../../context/context';
import { logger } from '../../utils/logger';

export function tryGetMsgIdFromTransferReceipt(
  origin: ChainName,
  receipt: TypedTransactionReceipt,
) {
  try {
    // IBC transfers have no message IDs
    if (receipt.type === ProviderType.CosmJs) return undefined;

    if (receipt.type === ProviderType.Viem) {
      // Massage viem type into ethers type because that's still what the
      // SDK expects. In this case they're compatible.
      receipt = {
        type: ProviderType.EthersV5,
        receipt: receipt.receipt as any,
      };
    }

    const multiProvider = getMultiProvider();
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
