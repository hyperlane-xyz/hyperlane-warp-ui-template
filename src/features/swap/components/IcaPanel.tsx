import { ChainName } from '@hyperlane-xyz/sdk';
import { useState } from 'react';
import { useIcaAddress } from '../hooks/useIcaAddress';
import { useInterchainAccountApp } from '../hooks/useInterchainAccount';
import { IcaBalanceDisplay } from './IcaBalanceDisplay';
import { IcaSendForm } from './IcaSendForm';

interface IcaPanelProps {
  userAddress: string | undefined;
  originChainName: ChainName;
  destinationChainName: ChainName;
}

export function IcaPanel({ userAddress, originChainName, destinationChainName }: IcaPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showSendForm, setShowSendForm] = useState(false);
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
  const showResolveHint = !icaAddress;
  const resolveHint = !icaApp
    ? 'ICA app is still initializing.'
    : !userAddress
      ? `Connect your ${originChainName} wallet to resolve the ICA address.`
      : isIcaAddressLoading
        ? 'Resolving ICA address...'
        : isIcaAddressError
          ? 'Failed to resolve ICA address.'
          : 'ICA address unavailable.';

  return (
    <div className="rounded-[7px] border border-gray-400/25 bg-white p-3 shadow-input">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="min-w-0">
          <span className="font-secondary text-base text-gray-900">Interchain account</span>
          <div className="truncate text-xs text-gray-500">
            {destDisplayName} account balances and return controls
          </div>
        </div>
        <span className="text-xs text-primary-500">{expanded ? 'Hide' : 'Manage'}</span>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-2">
          <IcaBalanceDisplay
            icaAddress={icaAddress}
            chainName={destDisplayName}
            destinationChainName={destinationChainName}
            isIcaAddressLoading={isIcaAddressLoading}
            canResolveAddress={canResolveAddress}
          />

          {showResolveHint ? (
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

          <button
            type="button"
            onClick={() => setShowSendForm((prev) => !prev)}
            disabled={!icaAddress || isIcaAddressLoading}
            className="w-full rounded border border-gray-300 bg-gray-150 px-3 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:text-gray-500"
          >
            {showSendForm ? 'Hide ICA actions' : 'Open ICA actions'}
          </button>

          {showSendForm ? (
            <IcaSendForm
              icaAddress={icaAddress}
              defaultRecipient={userAddress}
              originChainName={originChainName}
              destinationChainName={destinationChainName}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
