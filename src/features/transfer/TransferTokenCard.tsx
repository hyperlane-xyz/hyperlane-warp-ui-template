import { WideChevron } from '@hyperlane-xyz/widgets';

import { Card } from '../../components/layout/Card';
import { Color } from '../../styles/Color';

import { TransferTokenForm } from './TransferTokenForm';

export function TransferTokenCard() {
  return (
    <Card className="w-100 sm:w-[31rem]">
      <>
        <div className="absolute left-0 right-0 -top-36 xs:-top-[6.5rem] flex justify-center overflow-hidden z-10">
          <WideChevron
            direction="s"
            height="100%"
            width="100"
            rounded={true}
            color={Color.primaryBlue}
          />
        </div>
        <TransferTokenForm />
      </>
    </Card>
  );
}
