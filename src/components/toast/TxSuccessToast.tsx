import { toast } from 'react-toastify';

import { chainIdToMetadata } from '@hyperlane-xyz/sdk';

export function toastTxSuccess(msg: string, txHash: string, chainId: number) {
  toast.success(<TxSuccessToast msg={msg} txHash={txHash} chainId={chainId} />, {
    autoClose: 12000,
  });
}

export function TxSuccessToast({
  msg,
  txHash,
  chainId,
}: {
  msg: string;
  txHash: string;
  chainId: number;
}) {
  const explorerBaseUrl = chainIdToMetadata[chainId]?.blockExplorers[0].url;
  const url = explorerBaseUrl ? `${explorerBaseUrl}/tx/${txHash}` : '';
  return (
    <div>
      {msg + ' '}
      {url && (
        <a className="underline" href={url} target="_blank" rel="noopener noreferrer">
          Open in Explorer
        </a>
      )}
    </div>
  );
}
