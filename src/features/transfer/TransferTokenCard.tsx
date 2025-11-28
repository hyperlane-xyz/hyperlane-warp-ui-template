import { Card } from '../../components/layout/Card';
import { TransferTokenForm } from './TransferTokenForm';

export function TransferTokenCard() {
  return (
    <Card className="w-100 bg-[#f8f8ff] sm:w-[31rem]">
      <TransferTokenForm />
    </Card>
  );
}
