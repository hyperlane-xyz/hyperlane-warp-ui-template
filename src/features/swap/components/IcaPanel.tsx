import { ChainName } from '@hyperlane-xyz/sdk';
import { shortenAddress } from '@hyperlane-xyz/utils';
import { CopyButton, Modal, useModal } from '@hyperlane-xyz/widgets';
import { useIcaAddress } from '../hooks/useIcaAddress';
import { useInterchainAccountApp } from '../hooks/useInterchainAccount';
import { IcaBalanceDisplay } from './IcaBalanceDisplay';
import { IcaSendForm } from './IcaSendForm';
import { ModalHeader } from '../../../components/layout/ModalHeader';

interface IcaPanelProps {
  userAddress: string | undefined;
  originChainName: ChainName;
  destinationChainName: ChainName;
}

export function IcaPanel({ userAddress, originChainName, destinationChainName }: IcaPanelProps) {
  const { isOpen, open, close } = useModal();
  const icaApp = useInterchainAccountApp();
  const {
    icaAddress,
    isLoading: isIcaAddressLoading,
    isError: isIcaAddressError,
    refetch,
  } = useIcaAddress(icaApp, userAddress, originChainName, destinationChainName);
  const destDisplayName =
    destinationChainName.charAt(0).toUpperCase() + destinationChainName.slice(1);
  const canResolveAddress = !!icaApp && !!userAddress;
  const resolveHint = !icaApp
    ? 'ICA app is still initializing.'
    : !userAddress
      ? `Connect your ${originChainName} wallet to resolve the ICA address.`
      : isIcaAddressLoading
        ? 'Resolving ICA address...'
        : isIcaAddressError
          ? 'Failed to resolve ICA address.'
          : 'ICA address unavailable.';
  const summaryStatusLabel = !icaApp
    ? 'Initializing'
    : isIcaAddressLoading
      ? 'Resolving'
      : icaAddress
        ? 'Ready'
        : 'Unavailable';
  const isReady = !!icaAddress && !isIcaAddressLoading;

  return (
    <>
      <div className="rounded-[7px] border border-gray-400/25 bg-white p-3 shadow-input">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-secondary text-sm text-gray-900">Interchain account</span>
            <div className="text-xs leading-4 text-gray-500">
              {destDisplayName} balances and return controls
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <div className="flex items-center gap-1 rounded border border-gray-300 bg-gray-150 px-2 py-1 text-xs text-gray-700">
              <span>{summaryStatusLabel}</span>
              {isReady ? (
                <>
                  <span className="max-w-[8.5rem] truncate font-primary text-gray-900">
                    {shortenAddress(icaAddress)}
                  </span>
                  <CopyButton copyValue={icaAddress} width={13} height={13} className="opacity-50" />
                </>
              ) : null}
            </div>
            <button
              type="button"
              onClick={open}
              className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-900 transition-colors hover:bg-gray-100"
            >
              Manage ICA
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isOpen}
        close={close}
        panelClassname="p-0 max-w-sm md:max-w-[520px] overflow-hidden"
      >
        <ModalHeader>Interchain Account</ModalHeader>
        <div className="space-y-2 p-4">
          <IcaBalanceDisplay
            icaAddress={icaAddress}
            chainName={destDisplayName}
            destinationChainName={destinationChainName}
            isIcaAddressLoading={isIcaAddressLoading}
            canResolveAddress={canResolveAddress}
          />

          {!icaAddress || isIcaAddressError ? (
            <div className="flex items-center justify-between gap-2 rounded border border-gray-300 bg-gray-150 px-3 py-2 text-xs text-gray-700">
              <span>{resolveHint}</span>
              {isIcaAddressError ? (
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}

          {icaAddress && !isIcaAddressLoading ? (
            <IcaSendForm
              icaAddress={icaAddress}
              defaultRecipient={userAddress}
              originChainName={originChainName}
              destinationChainName={destinationChainName}
            />
          ) : null}
        </div>
      </Modal>
    </>
  );
}
