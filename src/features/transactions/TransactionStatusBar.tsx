import { useStore } from '../store';

export function TransactionStatusBar() {
  const txs = useStore((s) => s.transactions);
  return <div>{JSON.stringify(txs)}</div>;
}
