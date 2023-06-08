import { Menu, Transition } from '@headlessui/react';
import Image from 'next/image';
import { Fragment, useState } from 'react';

import { SolidButton } from '../../components/buttons/SolidButton';
import { ChainLogo } from '../../components/icons/ChainLogo';
import { Identicon } from '../../components/icons/Identicon';
import ChevronDown from '../../images/icons/chevron-down.svg';
import Logout from '../../images/icons/logout.svg';
import Wallet from '../../images/icons/wallet.svg';
import { shortenAddress } from '../../utils/addresses';
import { tryClipboardSet } from '../../utils/clipboard';
import { useIsSsr } from '../../utils/ssr';

import { WalletEnvSelectionModal } from './WalletEnvSelectionModal';
import { useAccounts, useActiveChains, useDisconnects } from './hooks';

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

  const { readyChains } = useActiveChains();
  const { readyAccounts } = useAccounts();
  const disconnects = useDisconnects();
  const numReady = readyAccounts.length;

  const onClickCopy = (value?: string) => async () => {
    if (!value) return;
    await tryClipboardSet(value);
  };

  const onClickDisconnect = async () => {
    for (const disconnectFn of Object.values(disconnects)) {
      await disconnectFn();
    }
  };

  return (
    <div className="relative">
      <Menu as="div" className="relative">
        {numReady === 0 && (
          <>
            <SolidButton
              classes="py-1.5 px-2.5"
              onClick={() => setShowEnvSelectModal(true)}
              title="Choose wallet"
              icon={<Image src={Wallet} alt="" width={16} height={16} />}
            >
              <div className="ml-1.5 text-white text-xs sm:text-sm">Connect Wallet</div>
            </SolidButton>
          </>
        )}

        {numReady === 1 && (
          <Menu.Button className="px-2 py-0.5 flex items-center justify-center rounded-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-500">
            <Identicon address={readyAccounts[0].address} size={26} />
            <div className="flex flex-col mx-3 items-start">
              <div className="text-xs text-gray-500">
                {readyAccounts[0].connectorName || 'Wallet'}
              </div>
              <div className="text-xs">
                {readyAccounts[0].address
                  ? shortenAddress(readyAccounts[0].address, true)
                  : 'Unknown'}
              </div>
            </div>
            <Icon src={ChevronDown} size={14} />
          </Menu.Button>
        )}

        {numReady > 1 && (
          <Menu.Button className="px-2 py-0.5 flex items-center justify-center rounded-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-500">
            <div
              style={{ height: 26, width: 26, ...styles }}
              className="bg-blue-500 text-white flex items-center justify-center rounded-full"
            >
              {numReady}
            </div>
            <div className="flex flex-col mx-3 items-start">
              <div className="text-xs text-gray-500">Wallets</div>
              <div className="text-xs">{`${numReady} Connected`}</div>
            </div>
            <Icon src={ChevronDown} size={14} />
          </Menu.Button>
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
          <Menu.Items className="absolute -right-1.5 mt-3 pt-2 pb-2 w-[22.5rem] origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            {readyAccounts.map((a, i) => (
              <Menu.Item key={`account-${i}`}>
                <button
                  className={styles.dropdownOption}
                  onClick={onClickCopy(a.address)}
                  title="Copy address"
                >
                  <div className="shrink-0">
                    <Identicon address={a.address} size={18} />
                  </div>
                  <div className="ml-2 text-xs break-words">{a.address || 'Unknown address'}</div>
                </button>
              </Menu.Item>
            ))}
            <Menu.Item>
              <button className={styles.dropdownOption} onClick={() => setShowEnvSelectModal(true)}>
                <Icon src={Wallet} alt="" size={18} className="invert" />
                <div className="ml-2">Connect wallet</div>
              </button>
            </Menu.Item>
            <Menu.Item>
              <button className={styles.dropdownOption} onClick={onClickDisconnect}>
                <Icon src={Logout} alt="" size={20} />
                <div className="ml-2">Disconnect all</div>
              </button>
            </Menu.Item>
            {readyChains.length > 0 && (
              <div className="px-4 pt-3 my-2 border-t border-gray-200">
                <label className="text-sm text-gray-500">Active chains:</label>
                <div className="mt-1.5 flex gap-4 flex-wrap">
                  {readyChains.map((c, i) => (
                    <div className="flex items-center" key={`chain-${i}`}>
                      <ChainLogo caip2Id={c.caip2Id} size={15} />
                      <div className="ml-2 text-sm">{c.chainDisplayName || 'Unknown'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Menu.Items>
        </Transition>
      </Menu>
      <WalletEnvSelectionModal
        isOpen={showEnvSelectModal}
        close={() => setShowEnvSelectModal(false)}
      />
    </div>
  );
}

function Icon({
  src,
  alt,
  size,
  className,
}: {
  src: any;
  alt?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center w-[20px] ${className}`}>
      <Image src={src} alt={alt || ''} width={size ?? 16} height={size ?? 16} />
    </div>
  );
}

const styles = {
  dropdownOption:
    'w-full flex items-center px-4 py-2 mt-1 text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-500',
};
