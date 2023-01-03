// import { IconButton } from '../../components/buttons/IconButton';
import { HyperlaneWideChevron } from '../../components/icons/HyperlaneChevron';
import { Card } from '../../components/layout/Card';

// import GearIcon from '../../images/icons/gear.svg';
import { TransferTokenForm } from './TransferTokenForm';

export function TransferTokenCard() {
  return (
    <Card classes="w-100 sm:w-[31rem] relative">
      <div className="absolute left-0 right-0 -top-32 xs:-top-24 flex justify-center overflow-hidden z-10">
        <HyperlaneWideChevron direction="s" height="100%" width="100" />
      </div>
      <div className="relative flex items-start justify-between z-20">
        <h2 className="pl-0.5 text-lg">Send Tokens</h2>
        {/* <IconButton
          imgSrc={GearIcon}
          width={20}
          height={20}
          title="Settings"
          classes="hover:rotate-90"
        /> */}
      </div>
      <TransferTokenForm />
    </Card>
  );
}
