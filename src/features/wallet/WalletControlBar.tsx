import Image from 'next/image';
import { useState } from 'react';

import { SolidButton } from '../../components/buttons/SolidButton';
import { Identicon } from '../../components/icons/Identicon';
import Wallet from '../../images/icons/wallet.svg';
import { shortenAddress } from '../../utils/addresses';
import { useIsSsr } from '../../utils/ssr';

import { SideBarMenu } from './SideBarMenu';
import { WalletEnvSelectionModal } from './WalletEnvSelectionModal';
import { useAccounts } from './hooks';

export function WalletControlBar() {
  const [showEnvSelectModal, setShowEnvSelectModal] = useState(false);
  const [isSideBarOpen, setIsSideBarOpen] = useState(false);

  const { readyAccounts } = useAccounts();
  const isSsr = useIsSsr();

  const numReady = readyAccounts.length;

  if (isSsr) {
    // https://github.com/wagmi-dev/wagmi/issues/542#issuecomment-1144178142
    return null;
  }

  return (
    <div className="relative">
      <div className="relative">
        {numReady === 0 && (
          <SolidButton
            classes="py-1.5 px-2.5"
            onClick={() => setShowEnvSelectModal(true)}
            title="Choose wallet"
            icon={<Image src={Wallet} alt="" width={16} height={16} />}
          >
            <div className="ml-1.5 text-white text-xs sm:text-sm">Connect Wallet</div>
          </SolidButton>
        )}

        {numReady === 1 && (
          <button
            onClick={() => setIsSideBarOpen(true)}
            className="px-2.5 py-1 flex items-center justify-center shadow-[0px_2px_4px_0px_rgba(0,0,0,0.10)] rounded-md bg-white hover:bg-gray-100 active:bg-gray-200 transition-all duration-500"
          >
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
          </button>
        )}

        {numReady > 1 && (
          <button
            onClick={() => setIsSideBarOpen(true)}
            className="px-2.5 py-1 flex items-center justify-center shadow-[0px_2px_4px_0px_rgba(0,0,0,0.10)] rounded-md bg-white hover:bg-gray-100 active:bg-gray-200 transition-all duration-500"
          >
            <div
              style={{ height: 26, width: 26 }}
              className="bg-blue-500 text-white flex items-center justify-center rounded-full"
            >
              {numReady}
            </div>
            <div className="flex flex-col mx-3 items-start">
              <div className="text-xs text-gray-500">Wallets</div>
              <div className="text-xs">{`${numReady} Connected`}</div>
            </div>
          </button>
        )}
      </div>

      <WalletEnvSelectionModal
        isOpen={showEnvSelectModal}
        close={() => setShowEnvSelectModal(false)}
      />
      {numReady > 0 && (
        <SideBarMenu
          onClose={() => setIsSideBarOpen(false)}
          isOpen={isSideBarOpen}
          onConnectWallet={() => setShowEnvSelectModal(true)}
        />
      )}
    </div>
  );
}
