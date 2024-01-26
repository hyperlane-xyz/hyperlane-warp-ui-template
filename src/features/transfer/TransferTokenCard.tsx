import { Card } from '../../components/layout/Card';
import { getWarpContext } from '../../context/context';

import { TransferTokenForm } from './TransferTokenForm';

export function TransferTokenCard() {
  return (
    <Card className="w-100 sm:w-[31rem]">
      <TransferTokenForm tokenRoutes={getWarpContext().routes} />
    </Card>
  );
}
