import { useMemo } from 'react';
import { toast } from 'react-toastify';

import { parseCaip2Id } from '../../features/caip/chains';
import { getMultiProvider } from '../../features/multiProvider';

export function toastTxSuccess(msg: string, txHash: string, chainCaip2Id: ChainCaip2Id) {
  toast.success(<TxSuccessToast msg={msg} txHash={txHash} chainCaip2Id={chainCaip2Id} />, {
    autoClose: 12000,
  });
}

export function TxSuccessToast({
  msg,
  txHash,
  chainCaip2Id,
}: {
  msg: string;
  txHash: string;
  chainCaip2Id: ChainCaip2Id;
}) {
  const url = useMemo(() => {
    const { reference } = parseCaip2Id(chainCaip2Id);
    return getMultiProvider().tryGetExplorerTxUrl(reference, { hash: txHash });
  }, [chainCaip2Id, txHash]);

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
