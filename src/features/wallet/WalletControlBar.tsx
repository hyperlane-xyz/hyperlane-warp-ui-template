import { useConnectModal } from '@rainbow-me/rainbowkit';
import Image from 'next/image';
import useDropdownMenu from 'react-accessible-dropdown-menu-hook';
import { toast } from 'react-toastify';
import { useAccount, useDisconnect, useNetwork } from 'wagmi';

import { SolidButton } from '../../components/buttons/SolidButton';
import { ChainIcon } from '../../components/icons/ChainIcon';
import { Identicon } from '../../components/icons/Identicon';
import ChevronDown from '../../images/icons/chevron-down.svg';
import CopyStack from '../../images/icons/copy-stack.svg';
import Logout from '../../images/icons/logout.svg';
import Wallet from '../../images/icons/wallet.svg';
import { shortenAddress } from '../../utils/addresses';
import { tryClipboardSet } from '../../utils/clipboard';
import { logger } from '../../utils/logger';
import { useIsSsr } from '../../utils/ssr';

export function WalletControlBar() {
  const isSsr = useIsSsr();
  if (isSsr) {
    // https://github.com/wagmi-dev/wagmi/issues/542#issuecomment-1144178142
    return null;
  }

  return (
    <div className="flex justify-center items-stretch py-1.5 px-1.5 space-x-1.5 bg-white shadow-md rounded-md">
      <AccountDropdown />
      {/* <OptionsDropdown /> */}
      {/* <ChainDropdown /> */}
    </div>
  );
}

function AccountDropdown() {
  const { chain } = useNetwork();
  const { address, isConnected, connector } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnectAsync } = useDisconnect();

  const isAccountReady = !!(address && isConnected && connector);

  const { buttonProps, itemProps, isOpen, setIsOpen } = useDropdownMenu(2);

  const onClickDisconnect = async () => {
    setIsOpen(false);
    try {
      if (!disconnectAsync) throw new Error('Disconnect function is null');
      await disconnectAsync();
    } catch (error) {
      logger.error('Error disconnecting to wallet', error);
      toast.error('Could not disconnect wallet');
    }
  };

  const onClickCopy = async () => {
    setIsOpen(false);
    if (!address) return;
    await tryClipboardSet(address);
  };

  return (
    <div className="relative">
      {isAccountReady ? (
        <SolidButton {...buttonProps} classes=" px-3 py-0.5" color="white">
          <Identicon address={address} size={26} />
          <div className="flex flex-col mx-3 items-start">
            <div className="text-xs text-gray-500">{connector.name}</div>
            <div className="text-xs">{shortenAddress(address, true)}</div>
          </div>
          <Icon src={ChevronDown} size={14} />
        </SolidButton>
      ) : (
        <SolidButton
          classes="py-1.5 px-2.5"
          onClick={openConnectModal}
          title="Choose wallet"
          icon={<Image src={Wallet} alt="" width={16} height={16} />}
        >
          <div className="ml-1.5 text-white text-sm">Connect Wallet</div>
        </SolidButton>
      )}

      <div className={`${styles.dropdownContainer} ${!isOpen && 'hidden'} -right-1.5`} role="menu">
        {chain?.name && chain.id && (
          <div className="px-2.5 pt-1 pb-3 mb-2 border-b border-gray-200">
            <label className="text-sm text-gray-500">Connected to:</label>
            <div className="mt-1 flex items-center">
              <ChainIcon chainId={chain.id} size={15} />
              <div className="ml-2 text-sm">{chain.name}</div>
            </div>
          </div>
        )}
        <a {...itemProps[0]} className={styles.dropdownOption} onClick={onClickCopy}>
          <Icon src={CopyStack} alt="Copy" size={15} />
          <div className="ml-2">Copy Address</div>
        </a>
        <a {...itemProps[1]} className={styles.dropdownOption} onClick={onClickDisconnect}>
          <Icon src={Logout} alt="Logout" size={20} />
          <div className="ml-2">Disconnect</div>
        </a>
      </div>
    </div>
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
  dropdownContainer: 'dropdown-menu w-44 mt-3 bg-white',
  dropdownOption:
    'flex items-center cursor-pointer p-2 mt-1 rounded-sm text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-500',
};
