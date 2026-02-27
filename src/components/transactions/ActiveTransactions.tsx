import { useMemo } from 'react';
import { useStore } from '../../features/store';
import { Card } from '../layout/Card';
import { TransactionItem } from './TransactionItem';

export function ActiveTransactions() {
  const { transfers } = useStore((s) => ({
    transfers: s.transfers,
    transferLoading: s.transferLoading,
  }));

  const transfersList = useMemo(() => transfers.filter(t => t.status === "signing-transfer"), [transfers]);
  if (!transfersList.length) return null;

  return (
    <Card className="w-100 p-2 sm:w-[31rem]">
      <h2 className="text-primary-500 mb-2">Active Transactions</h2>
      <div className="flex flex-col gap-2">
        {transfersList.map((item) => <TransactionItem key={item.originTxHash} transaction={item} />)}
      </div>
    </Card>
  );
}
