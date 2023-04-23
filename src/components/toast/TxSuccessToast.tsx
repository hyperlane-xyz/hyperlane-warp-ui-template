import { toast } from 'react-toastify';

import { getMultiProvider } from '../../features/multiProvider';

export function toastTxSuccess(msg: string, txHash: string, chainId: ChainId) {
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
  chainId: ChainId;
}) {
  const url = getMultiProvider().tryGetExplorerTxUrl(chainId, { hash: txHash });
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
