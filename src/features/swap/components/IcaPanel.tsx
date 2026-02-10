import { useState } from 'react';
import { useIcaAddress } from '../hooks/useIcaAddress';
import { IcaBalanceDisplay } from './IcaBalanceDisplay';
import { IcaSendForm } from './IcaSendForm';

interface IcaPanelProps {
  userAddress: string | undefined;
  originChainName: string;
  destinationChainName: string;
}

export function IcaPanel({ userAddress, originChainName, destinationChainName }: IcaPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showSendForm, setShowSendForm] = useState(false);
  const { icaAddress } = useIcaAddress(userAddress, originChainName, destinationChainName);
  const destDisplayName =
    destinationChainName.charAt(0).toUpperCase() + destinationChainName.slice(1);

  return (
    <div className="rounded-[7px] border border-gray-400/25 bg-white p-4 shadow-input">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="font-secondary text-base text-gray-900">Interchain Account</span>
        <span className="text-xs text-primary-500">{expanded ? 'Hide' : 'Show'}</span>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-2">
          <div className="rounded border border-primary-100 bg-primary-50 px-3 py-2 text-xs text-primary-700">
            Funds will arrive in your Interchain Account on {destDisplayName}.
          </div>

          <IcaBalanceDisplay
            icaAddress={icaAddress}
            chainName={destDisplayName}
            destinationChainName={destinationChainName}
          />

          <button
            type="button"
            onClick={() => setShowSendForm((prev) => !prev)}
            className="w-full rounded border border-gray-300 bg-gray-150 px-3 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-200"
          >
            {showSendForm ? 'Hide send form' : 'Send from ICA'}
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
