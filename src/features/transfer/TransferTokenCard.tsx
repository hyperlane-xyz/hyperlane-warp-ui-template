import { Card } from '../../components/layout/Card';
import { TransferTokenForm } from './TransferTokenForm';

export function TransferTokenCard() {
  return (
    <Card className="transfer-card w-100 sm:w-[31rem]">
      <TransferTokenForm />
    </Card>
  );
}
