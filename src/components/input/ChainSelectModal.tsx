import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

import { mainnetChains, testnetChains } from '../../consts/chains';
import XCircle from '../../images/icons/x-circle.svg';
import { getChainDisplayName } from '../../utils/chains';
import { IconButton } from '../buttons/IconButton';
import { ChainIcon } from '../icons/ChainIcon';

export function ChainSelectModal({
  isOpen,
  close,
  onSelect,
}: {
  isOpen: boolean;
  close: () => void;
  onSelect: (chainId: number) => void;
}) {
  const onSelectChain = (chainId: number) => {
    return () => {
      onSelect(chainId);
      close();
    };
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-30" onClose={close}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-xs transform overflow-hidden rounded-md bg-white px-5 py-5 text-left shadow-lg transition-all">
                <Dialog.Title as="h3" className="text text-gray-700">
                  Select Chain
                </Dialog.Title>
                <div className="mt-1 flex justify-between">
                  <div className="flex flex-col space-y-0.5 relative -left-2">
                    <h4 className="py-1.5 px-2 text-sm text-gray-500 uppercase">Mainnet</h4>
                    {mainnetChains.map((c) => (
                      <button
                        key={c.name}
                        className="py-1.5 px-2 text-sm flex items-center rounded hover:bg-gray-100 active:bg-gray-200 transition-all duration-200"
                        onClick={onSelectChain(c.id)}
                      >
                        <ChainIcon chainId={c.id} size={16} background={false} />
                        <span className="ml-2">{getChainDisplayName(c.id, true)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col space-y-0.5 pr-3">
                    <h4 className="py-1.5 px-2 text-sm text-gray-500 uppercase">Testnet</h4>
                    {testnetChains.map((c) => (
                      <button
                        key={c.name}
                        className="py-1.5 px-2 text-sm flex items-center rounded hover:bg-gray-100 active:bg-gray-200 transition-all duration-200"
                        onClick={onSelectChain(c.id)}
                      >
                        <ChainIcon chainId={c.id} size={16} background={false} />
                        <span className="ml-2">{getChainDisplayName(c.id, true)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="absolute right-3 top-3">
                  <IconButton
                    imgSrc={XCircle}
                    onClick={close}
                    title="Hide tip"
                    classes="hover:rotate-90"
                  />
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
