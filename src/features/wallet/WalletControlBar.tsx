import { Menu } from '@headlessui/react';
import Image from 'next/image';
import { useState } from 'react';

import { SolidButton } from '../../components/buttons/SolidButton';
import Wallet from '../../images/icons/wallet.svg';
import { useIsSsr } from '../../utils/ssr';

import { SideBarMenu } from './SideBarMenu';
import { WalletEnvSelectionModal } from './WalletEnvSelectionModal';
import { useAccounts } from './hooks';

export function WalletControlBar() {
  const [showEnvSelectModal, setShowEnvSelectModal] = useState(false);
  const { readyAccounts } = useAccounts();
  const isSsr = useIsSsr();

  const numReady = readyAccounts.length;

  if (isSsr) {
    // https://github.com/wagmi-dev/wagmi/issues/542#issuecomment-1144178142
    return null;
  }

  return (
    <div className="relative">
      {numReady === 0 && (
        <Menu as="div" className="relative">
          <SolidButton
            classes="py-1.5 px-2.5"
            onClick={() => setShowEnvSelectModal(true)}
            title="Choose wallet"
            icon={<Image src={Wallet} alt="" width={16} height={16} />}
          >
            <div className="ml-1.5 text-white text-xs sm:text-sm">Connect Wallet</div>
          </SolidButton>
        </Menu>
      )}
      <WalletEnvSelectionModal
        isOpen={showEnvSelectModal}
        close={() => setShowEnvSelectModal(false)}
      />
      {numReady > 0 && <SideBarMenu onConnectWallet={() => setShowEnvSelectModal(true)} />}
    </div>
  );
}
