import { isAddress } from '@hyperlane-xyz/utils';
import { useEffect, useMemo, useState } from 'react';
import { useWalletClient } from 'wagmi';
import { useIcaBalance } from '../hooks/useIcaBalance';
import { useIcaTransaction } from '../hooks/useIcaTransaction';
import { useInterchainAccountApp } from '../hooks/useInterchainAccount';
import { getSwapConfig } from '../swapConfig';

interface IcaSendFormProps {
  icaAddress: string | null;
  defaultRecipient?: string;
  originChainName: string;
  destinationChainName: string;
}

export function IcaSendForm({
  icaAddress,
  defaultRecipient,
  originChainName,
  destinationChainName,
}: IcaSendFormProps) {
  const destConfig = getSwapConfig(destinationChainName);
  const { data: walletClient } = useWalletClient();
  const { data: balances } = useIcaBalance(
    icaAddress,
    destConfig?.chainId ?? 0,
    destinationChainName,
  );
  const icaApp = useInterchainAccountApp();
  const { status, error, txHash, sendFromIca, reset } = useIcaTransaction(
    icaApp,
    originChainName,
    destinationChainName,
  );

  const tokenOptions = useMemo(() => balances?.tokens || [], [balances?.tokens]);
  const [selectedToken, setSelectedToken] = useState(tokenOptions[0]?.address || '');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'send-destination' | 'return-origin'>('return-origin');
  const [recipient, setRecipient] = useState(defaultRecipient || walletClient?.account?.address || '');
  const [formError, setFormError] = useState<string | null>(null);

  const activeToken = useMemo(
    () => tokenOptions.find((token) => token.address === selectedToken) || tokenOptions[0],
    [selectedToken, tokenOptions],
  );

  useEffect(() => {
    if (mode === 'return-origin') {
      setRecipient(defaultRecipient || walletClient?.account?.address || '');
    }
  }, [mode, defaultRecipient, walletClient?.account?.address]);

  const insufficientBalance =
    !!activeToken && !!amount && Number(amount) > Number(activeToken.balance);

  const canSend =
    !!walletClient &&
    !!icaAddress &&
    !!activeToken &&
    !!amount &&
    !!recipient &&
    isAddress(recipient) &&
    activeToken.symbol !== 'ETH' &&
    !insufficientBalance &&
    status !== 'building' &&
    status !== 'signing' &&
    status !== 'confirming';

  const onSubmit = async () => {
    if (!walletClient) {
      setFormError(`Connect a ${originChainName} wallet first.`);
      return;
    }

    if (!icaAddress) {
      setFormError('ICA address is still resolving. Retry in a few seconds.');
      return;
    }

    if (!activeToken) {
      setFormError('Select a token.');
      return;
    }

    if (activeToken.symbol === 'ETH') {
      setFormError('ETH send is not supported yet. Use USDC.');
      return;
    }

    if (!isAddress(recipient)) {
      setFormError('Recipient must be a valid EVM address.');
      return;
    }

    if (insufficientBalance) {
      setFormError('Insufficient ICA balance for this amount.');
      return;
    }

    setFormError(null);
    await sendFromIca({
      token: activeToken.address,
      amount,
      recipient,
      mode,
      signer: walletClient,
      decimals: activeToken.symbol === 'USDC' ? 6 : 18,
    });
  };

  return (
    <div className="mt-2 rounded-[7px] border border-gray-400/25 bg-white p-3 shadow-input">
      <h4 className="font-secondary text-sm text-gray-900">Send from ICA</h4>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode('return-origin')}
          className={`rounded border px-2 py-1 text-xs ${
            mode === 'return-origin'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-300 bg-white text-gray-700'
          }`}
        >
          Return to origin
        </button>
        <button
          type="button"
          onClick={() => setMode('send-destination')}
          className={`rounded border px-2 py-1 text-xs ${
            mode === 'send-destination'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-300 bg-white text-gray-700'
          }`}
        >
          Send on destination
        </button>
      </div>

      <div className="mt-2 space-y-2">
        <label className="block text-xs text-gray-700">Token</label>
        <select
          value={activeToken?.address || ''}
          onChange={(event) => setSelectedToken(event.target.value)}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          {tokenOptions.map((token) => (
            <option key={token.address} value={token.address}>
              {token.symbol}
            </option>
          ))}
        </select>

        <label className="block text-xs text-gray-700">Amount</label>
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
          type="number"
          step="any"
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        />

        <label className="block text-xs text-gray-700">Recipient</label>
        <input
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
          placeholder="0x..."
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        />

        {insufficientBalance && (
          <div className="rounded border border-red-300 bg-red-50 px-2 py-1.5 text-xs text-red-700">
            Insufficient ICA balance.
          </div>
        )}
      </div>

      {(formError || error) && (
        <div className="mt-2 rounded border border-red-300 bg-red-50 px-2 py-1.5 text-xs text-red-700">
          {formError || error}
        </div>
      )}

      {txHash && (
        <div className="mt-2 rounded border border-green-300 bg-green-50 px-2 py-1.5 text-xs text-green-700">
          ICA send submitted: {txHash.slice(0, 10)}...
        </div>
      )}

      <button
        type="button"
        onClick={() => void onSubmit()}
        disabled={!canSend}
        className="mt-3 w-full rounded bg-primary-500 py-2 text-sm text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
      >
        {status === 'building' || status === 'signing' || status === 'confirming'
          ? 'Sending...'
          : mode === 'return-origin'
            ? 'Return to origin'
            : 'Send on destination'}
      </button>

      {status === 'complete' || status === 'failed' ? (
        <button
          type="button"
          onClick={reset}
          className="mt-2 w-full text-xs text-primary-500 underline-offset-2 hover:underline"
        >
          Reset status
        </button>
      ) : null}
    </div>
  );
}
