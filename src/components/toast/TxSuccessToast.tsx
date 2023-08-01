import { useMemo } from 'react';
import { toast } from 'react-toastify';

import { parseCaip2Id } from '../../features/caip/chains';
import { getMultiProvider } from '../../features/multiProvider';

export function toastTxSuccess(msg: string, txHash: string, caip2Id: Caip2Id) {
  toast.success(<TxSuccessToast msg={msg} txHash={txHash} caip2Id={caip2Id} />, {
    autoClose: 12000,
  });
}

export function TxSuccessToast({
  msg,
  txHash,
  caip2Id,
}: {
  msg: string;
  txHash: string;
  caip2Id: Caip2Id;
}) {
  const url = useMemo(() => {
    const { reference } = parseCaip2Id(caip2Id);
    return getMultiProvider().tryGetExplorerTxUrl(reference, { hash: txHash });
  }, [caip2Id, txHash]);

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
