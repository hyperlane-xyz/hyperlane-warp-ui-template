import Image from 'next/image';
import { useState } from 'react';

import { ProtocolType, shortenAddress } from '@hyperlane-xyz/utils';

import { SolidButton } from '../../components/buttons/SolidButton';
import { WalletLogo } from '../../components/icons/WalletLogo';
import Wallet from '../../images/icons/wallet.svg';
import { useIsSsr } from '../../utils/ssr';

import { SideBarMenu } from './SideBarMenu';
import { WalletEnvSelectionModal } from './WalletEnvSelectionModal';
import { useAccounts, useWalletDetails } from './hooks/multiProtocol';

export function WalletControlBar() {
  const isSsr = useIsSsr();

  const [showEnvSelectModal, setShowEnvSelectModal] = useState(false);
  const [isSideBarOpen, setIsSideBarOpen] = useState(false);

  const { readyAccounts } = useAccounts();
  const walletDetails = useWalletDetails();

  const numReady = readyAccounts.length;
  const firstAccount = readyAccounts[0];
  const firstWallet = walletDetails[firstAccount?.protocol || ProtocolType.Ethereum];

  if (isSsr) {
    // https://github.com/wagmi-dev/wagmi/issues/542#issuecomment-1144178142
    return null;
  }

  return (
    <div className="relative">
      <div className="relative">
        {numReady === 0 && (
          <SolidButton
            classes="py-2 px-3"
            onClick={() => setShowEnvSelectModal(true)}
            title="Choose wallet"
            icon={<Image src={Wallet} alt="" width={16} height={16} />}
            color="white"
          >
            <div className="ml-1.5 text-xs sm:text-sm">Connect Wallet</div>
          </SolidButton>
        )}

        {numReady === 1 && (
          <SolidButton onClick={() => setIsSideBarOpen(true)} classes="px-2.5 py-1" color="white">
            <div className="flex items-center justify-center">
              <WalletLogo walletDetails={firstWallet} size={26} />
              <div className="flex flex-col mx-3 items-start">
                <div className="text-xs text-gray-500">{firstWallet.name || 'Wallet'}</div>
                <div className="text-xs">
                  {readyAccounts[0].addresses.length
                    ? shortenAddress(readyAccounts[0].addresses[0].address, true)
                    : 'Unknown'}
                </div>
              </div>
            </div>
          </SolidButton>
        )}

        {numReady > 1 && (
          <SolidButton onClick={() => setIsSideBarOpen(true)} classes="px-2.5 py-1" color="white">
            <div className="flex items-center justify-center">
              <div
                style={{ height: 26, width: 26 }}
                className="bg-pink-500 text-white flex items-center justify-center rounded-full"
              >
                {numReady}
              </div>
              <div className="flex flex-col mx-3 items-start">
                <div className="text-xs text-gray-500">Wallets</div>
                <div className="text-xs">{`${numReady} Connected`}</div>
              </div>
            </div>
          </SolidButton>
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
