import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { ConnectButton } from '@midl-xyz/satoshi-kit';
import Image from 'next/image';
import { useState } from 'react';
import BtcIcon from './assets/btc.svg';
import EthIcon from './assets/eth.svg';

interface WalletTypeSelectModalProps {
  isOpen: boolean;
  close: () => void;
  onEvmSelected: () => void;
}

export function WalletTypeSelectModal({
  isOpen,
  close,
  onEvmSelected,
}: WalletTypeSelectModalProps) {
  const [showBitcoinConnect, setShowBitcoinConnect] = useState(false);

  const handleEvmClick = () => {
    close();
    onEvmSelected();
  };

  const handleBtcClick = () => {
    setShowBitcoinConnect(true);
  };

  return (
    <Dialog open={isOpen} onClose={close} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto w-full max-w-md rounded-2xl bg-white p-6">
          <DialogTitle className="mb-6 text-center text-lg font-semibold text-gray-900">
            Select Wallet Type
          </DialogTitle>

          <div className="space-y-4">
            {/* EVM Option */}
            <button
              onClick={handleEvmClick}
              className="w-full rounded-xl border-2 border-gray-200 bg-white p-6 transition-all hover:border-primary-500 hover:shadow-md"
            >
              <div className="flex flex-col items-center gap-3">
                <Image src={EthIcon} alt="eth" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">EVM</h3>
                  <p className="text-sm text-gray-600">Connect to an EVM compatible wallet</p>
                </div>
              </div>
            </button>

            {/* BTC Option */}
            {showBitcoinConnect ? (
              <div className="rounded-xl border-2 border-primary-500 bg-white p-6">
                <div className="flex flex-col items-center gap-4">
                  <Image src={BtcIcon} alt="btc" />
                  <div className="w-full">
                    <h3 className="mb-2 text-center text-lg font-semibold text-gray-900">BTC</h3>
                    <ConnectButton>
                      {({ openConnectDialog, isConnected }) => (
                        <button
                          onClick={() => {
                            openConnectDialog();
                            if (isConnected) {
                              close();
                            }
                          }}
                          className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
                        >
                          {isConnected ? 'Connected' : 'Connect Bitcoin Wallet'}
                        </button>
                      )}
                    </ConnectButton>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={handleBtcClick}
                className="w-full rounded-xl border-2 border-gray-200 bg-white p-6 transition-all hover:border-orange-500 hover:shadow-md"
              >
                <div className="flex flex-col items-center gap-3">
                  <Image src={BtcIcon} alt="btc" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">BTC</h3>
                    <p className="text-sm text-gray-600">Connect to a BTC compatible wallet</p>
                  </div>
                </div>
              </button>
            )}
          </div>

          <button
            onClick={close}
            className="mt-6 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
