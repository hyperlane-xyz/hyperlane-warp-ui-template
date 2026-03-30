import { ProtocolType } from '@hyperlane-xyz/utils';
import { Modal } from '@hyperlane-xyz/widgets/layout/Modal';
import { PROTOCOL_TO_LOGO } from '@hyperlane-xyz/widgets/logos/protocols';
import { useAleoConnectFn } from '@hyperlane-xyz/widgets/walletIntegrations/aleoWallet';
import { useCosmosConnectFn } from '@hyperlane-xyz/widgets/walletIntegrations/cosmosWallet';
import { useEthereumConnectFn } from '@hyperlane-xyz/widgets/walletIntegrations/ethereumWallet';
import { useRadixConnectFn } from '@hyperlane-xyz/widgets/walletIntegrations/radixWallet';
import { useSolanaConnectFn } from '@hyperlane-xyz/widgets/walletIntegrations/solanaWallet';
import { useStarknetConnectFn } from '@hyperlane-xyz/widgets/walletIntegrations/starknetWallet';
import { useTronConnectFn } from '@hyperlane-xyz/widgets/walletIntegrations/tronWallet';
import clsx from 'clsx';

import { logger } from '../../utils/logger';

interface WalletProtocolModalProps {
  isOpen: boolean;
  close: () => void;
  protocols?: ProtocolType[];
  onProtocolSelected?: (protocol: ProtocolType) => void;
}

export const PROTOCOL_OPTIONS = [
  { protocol: ProtocolType.Ethereum, title: 'EVM', subtitle: 'an EVM' },
  { protocol: ProtocolType.Sealevel, title: 'Solana', subtitle: 'a Solana' },
  { protocol: ProtocolType.Cosmos, title: 'Cosmos', subtitle: 'a Cosmos' },
  { protocol: ProtocolType.Starknet, title: 'Starknet', subtitle: 'a Starknet' },
  { protocol: ProtocolType.Radix, title: 'Radix', subtitle: 'a Radix' },
  { protocol: ProtocolType.Tron, title: 'Tron', subtitle: 'a Tron' },
  {
    protocol: ProtocolType.Aleo,
    title: 'Aleo',
    subtitle: 'an Aleo',
    logoClassName: 'wallet-protocol-aleo-logo',
  },
];

export function WalletProtocolModal({
  isOpen,
  close,
  protocols,
  onProtocolSelected,
}: WalletProtocolModalProps) {
  const connectFns: Partial<Record<ProtocolType, (() => void) | undefined>> = {
    [ProtocolType.Ethereum]: useEthereumConnectFn(),
    [ProtocolType.Sealevel]: useSolanaConnectFn(),
    [ProtocolType.Cosmos]: useCosmosConnectFn(),
    [ProtocolType.Starknet]: useStarknetConnectFn(),
    [ProtocolType.Radix]: useRadixConnectFn(),
    [ProtocolType.Tron]: useTronConnectFn(),
    [ProtocolType.Aleo]: useAleoConnectFn(),
  };

  const onClickProtocol = (protocol: ProtocolType) => {
    const connectFn = connectFns[protocol];
    if (!connectFn) {
      // eslint-disable-next-line no-console
      console.error(`No wallet connect function configured for protocol: ${protocol}`);
      return;
    }
    close();
    onProtocolSelected?.(protocol);
    connectFn();
  };

  const includesProtocol = (protocol: ProtocolType) => !protocols || protocols.includes(protocol);

  return (
    <Modal
      isOpen={isOpen}
      close={close}
      dialogClassname="wallet-protocol-dialog"
      panelClassname="wallet-protocol-modal max-w-[44rem] p-4 dark:border dark:border-edge/60 dark:bg-surface dark:text-foreground-primary dark:shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
    >
      <div className="wallet-protocol-grid flex flex-wrap justify-center gap-2.5 py-2">
        {PROTOCOL_OPTIONS.filter((option) => includesProtocol(option.protocol)).map((option) => {
          const Logo = PROTOCOL_TO_LOGO[option.protocol];
          if (!Logo) {
            logger.error('Missing protocol logo mapping for', option.protocol);
            return null;
          }
          return (
            <button
              type="button"
              key={option.protocol}
              onClick={() => onClickProtocol(option.protocol)}
              className="wallet-protocol-card flex basis-[calc(50%-0.5rem)] flex-col items-center space-y-2.5 rounded-lg border border-gray-200 py-3.5 transition-all hover:bg-gray-100 active:scale-95 sm:basis-[calc(33.333%-0.5rem)] dark:border-edge/60 dark:bg-background/80 dark:hover:bg-surface/85"
            >
              <Logo
                width={34}
                height={34}
                className={clsx(
                  option.logoClassName,
                  option.protocol === ProtocolType.Aleo &&
                    'dark:text-foreground-primary dark:[&_polygon]:fill-current',
                )}
              />
              <div className="wallet-protocol-title tracking-wide text-gray-800 dark:text-foreground-primary">
                {option.title}
              </div>
              <div className="wallet-protocol-subtitle text-sm text-gray-500 dark:text-foreground-secondary">
                {`Connect to ${option.subtitle}-compatible wallet`}
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
