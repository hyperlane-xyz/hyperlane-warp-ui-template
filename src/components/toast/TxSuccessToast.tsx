import { toast } from 'react-toastify';
import { useMultiProvider } from '../../features/chains/hooks';
import { getHypExplorerSearchLink, getHypExplorerTxLink } from '../../utils/links';

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
  const multiProvider = useMultiProvider();
  const explorerTxLink = getHypExplorerTxLink(multiProvider, chain, txHash);
  const url = explorerTxLink || getHypExplorerSearchLink(txHash);

  return (
    <div>
      {msg + ' '}
      {url && (
        <a className="underline" href={url} target="_blank" rel="noopener noreferrer">
          Open in Hyperlane Explorer
        </a>
      )}
    </div>
  );
}
