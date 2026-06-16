import { ProtocolType, eqAddress, isValidAddressEvm } from '@hyperlane-xyz/utils';
import { useEffect, useState } from 'react';

import { logger } from '../../utils/logger';
import { isSmartContract } from './utils';

export function useSmartContractRecipientWarning({
  enabled = true,
  multiProvider,
  originChainName,
  destinationChainName,
  connectedWallet,
  recipient,
}: {
  enabled?: boolean;
  multiProvider: Parameters<typeof isSmartContract>[0];
  originChainName: string | undefined;
  destinationChainName: string | undefined;
  connectedWallet: string | undefined;
  recipient: string;
}) {
  const [{ addressConfirmed, showWarning }, setRecipientWarning] = useState({
    addressConfirmed: true,
    showWarning: false,
  });

  useEffect(() => {
    let isMounted = true;

    const reset = () => setRecipientWarning({ addressConfirmed: true, showWarning: false });

    const checkSameEvmRecipient = async () => {
      if (
        !enabled ||
        !connectedWallet ||
        !originChainName ||
        !destinationChainName ||
        !isValidAddressEvm(recipient)
      ) {
        reset();
        return;
      }

      const { protocol: originProtocol } = multiProvider.getChainMetadata(originChainName);
      const { protocol: destinationProtocol } =
        multiProvider.getChainMetadata(destinationChainName);
      if (
        originProtocol !== ProtocolType.Ethereum ||
        destinationProtocol !== ProtocolType.Ethereum
      ) {
        reset();
        return;
      }

      const { isContract: isSenderSmartContract, error: senderCheckError } = await isSmartContract(
        multiProvider,
        originChainName,
        connectedWallet,
      );
      if (!isMounted) return;

      const { isContract: isRecipientSmartContract, error: recipientCheckError } =
        await isSmartContract(multiProvider, destinationChainName, recipient);
      if (!isMounted) return;

      if (senderCheckError || recipientCheckError) {
        logger.warn(senderCheckError || recipientCheckError);
        reset();
        return;
      }

      const shouldWarn =
        eqAddress(recipient, connectedWallet) && isSenderSmartContract && !isRecipientSmartContract;
      setRecipientWarning({
        addressConfirmed: !shouldWarn,
        showWarning: shouldWarn,
      });
    };

    void checkSameEvmRecipient();

    return () => {
      isMounted = false;
    };
  }, [enabled, recipient, connectedWallet, multiProvider, originChainName, destinationChainName]);

  return {
    addressConfirmed,
    showWarning,
    setAddressConfirmed: (checked: boolean) =>
      setRecipientWarning((state) => ({ ...state, addressConfirmed: checked })),
  };
}
