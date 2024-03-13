import { useMemo } from 'react';
import { toast } from 'react-toastify';

import { getMultiProvider } from '../../context/context';

export function toastTxSuccess(msg: string, txHash: string, chain: ChainName) {
  toast.success(<TxSuccessToast msg={msg} txHash={txHash} chain={chain} />, {
    autoClose: 12000,
  });
}

export function TxSuccessToast({
  msg,
  txHash,
  chain,
}: {
  msg: string;
  txHash: string;
  chain: ChainName;
}) {
  const url = useMemo(() => {
    return getMultiProvider().tryGetExplorerTxUrl(chain, { hash: txHash });
  }, [chain, txHash]);

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
