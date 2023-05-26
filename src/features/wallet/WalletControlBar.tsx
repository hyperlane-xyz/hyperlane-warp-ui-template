import { Menu, Transition } from '@headlessui/react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import Image from 'next/image';
import { Fragment, useState } from 'react';
import { toast } from 'react-toastify';
import { useAccount, useDisconnect, useNetwork } from 'wagmi';

import { ChainLogo } from '@hyperlane-xyz/widgets';

import { SolidButton } from '../../components/buttons/SolidButton';
import { Identicon } from '../../components/icons/Identicon';
import ChevronDown from '../../images/icons/chevron-down.svg';
import CopyStack from '../../images/icons/copy-stack.svg';
import Logout from '../../images/icons/logout.svg';
import Wallet from '../../images/icons/wallet.svg';
import { shortenAddress } from '../../utils/addresses';
import { tryClipboardSet } from '../../utils/clipboard';
import { logger } from '../../utils/logger';
import { useIsSsr } from '../../utils/ssr';

import { WalletEnvSelectionModal } from './WalletEnvSelectionModal';

export function WalletControlBar() {
  const isSsr = useIsSsr();
  if (isSsr) {
    // https://github.com/wagmi-dev/wagmi/issues/542#issuecomment-1144178142
    return null;
  }

  return (
    <div className="flex justify-center py-1 px-1 bg-white shadow-md rounded-md">
      <AccountDropdown />
    </div>
  );
}

function AccountDropdown() {
  const [showEnvSelectModal, setShowEnvSelectModal] = useState(false);

  const { chain } = useNetwork();
  const { address, isConnected, connector } = useAccount();

  const { disconnectAsync } = useDisconnect();

  const isAccountReady = !!(address && isConnected && connector);

  const onClickDisconnect = async () => {
    try {
      if (!disconnectAsync) throw new Error('Disconnect function is null');
      await disconnectAsync();
    } catch (error) {
      logger.error('Error disconnecting to wallet', error);
      toast.error('Could not disconnect wallet');
    }
  };

  const onClickCopy = async () => {
    if (!address) return;
    await tryClipboardSet(address);
  };

  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  console.log('publicKey', publicKey);

  return (
    <Menu as="div" className="relative">
      {isAccountReady ? (
        <Menu.Button className="px-2 py-0.5 flex items-center justify-center rounded-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-500">
          <Identicon address={address} size={26} />
          <div className="flex flex-col mx-3 items-start">
            <div className="text-xs text-gray-500">{connector.name}</div>
            <div className="text-xs">{shortenAddress(address, true)}</div>
          </div>
          <Icon src={ChevronDown} size={14} />
        </Menu.Button>
      ) : (
        <>
          <SolidButton
            classes="py-1.5 px-2.5"
            onClick={() => setShowEnvSelectModal(true)}
            title="Choose wallet"
            icon={<Image src={Wallet} alt="" width={16} height={16} />}
          >
            <div className="ml-1.5 text-white text-xs sm:text-sm">Connect Wallet</div>
          </SolidButton>
          <WalletEnvSelectionModal
            isOpen={showEnvSelectModal}
            close={() => setShowEnvSelectModal(false)}
          />
        </>
      )}

      <Transition
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-100"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute -right-1.5 mt-3 pt-3 pb-2 w-44 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {chain?.name && chain.id && (
            <div className="px-5 pb-3 mb-2 border-b border-gray-200">
              <label className="text-sm text-gray-500">Connected to:</label>
              <div className="mt-1.5 flex items-center">
                <ChainLogo chainId={chain.id} size={15} />
                <div className="ml-2 text-sm">{chain.name}</div>
              </div>
            </div>
          )}
          <Menu.Item>
            <button className={styles.dropdownOption} onClick={onClickCopy}>
              <Icon src={CopyStack} alt="Copy" size={15} />
              <div className="ml-2">Copy Address</div>
            </button>
          </Menu.Item>
          <Menu.Item>
            <button className={styles.dropdownOption} onClick={onClickDisconnect}>
              <Icon src={Logout} alt="Logout" size={20} />
              <div className="ml-2">Disconnect</div>
            </button>
          </Menu.Item>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}

function Icon({ src, alt, size }: { src: any; alt?: string; size?: number }) {
  return (
    <div className="flex items-center justify-center w-[20px]">
      <Image src={src} alt={alt || ''} width={size ?? 16} height={size ?? 16} />
    </div>
  );
}

const styles = {
  dropdownOption:
    'w-full flex items-center px-5 py-2 mt-1 text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-500',
};
