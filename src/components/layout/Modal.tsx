import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { IconButton, XCircleIcon } from '@hyperlane-xyz/widgets';
import { Fragment, PropsWithChildren } from 'react';

export function Modal({
  isOpen,
  title,
  close,
  width,
  padding,
  children,
  showCloseBtn = true,
}: PropsWithChildren<{
  isOpen: boolean;
  title: string;
  close: () => void;
  width?: string;
  padding?: string;
  showCloseBtn?: boolean;
}>) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-30" onClose={close}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel
                className={`w-full ${
                  width || 'max-w-xs'
                } max-h-[90vh] transform overflow-auto rounded-2xl bg-white ${
                  padding || 'px-4 py-4'
                } text-left shadow-lg transition-all`}
              >
                <DialogTitle as="h3" className="text text-gray-700">
                  {title}
                </DialogTitle>
                {children}
                {showCloseBtn && (
                  <div className="absolute right-3 top-3">
                    <IconButton onClick={close} title="Close" className="hover:rotate-90">
                      <XCircleIcon width={16} height={16} />
                    </IconButton>
                  </div>
                )}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
