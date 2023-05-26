import { useConnectModal } from '@rainbow-me/rainbowkit';
import Image from 'next/image';
import { PropsWithChildren } from 'react';

import EthereumLogo from '@hyperlane-xyz/sdk/logos/color/ethereum.svg';

import { Modal } from '../../components/layout/Modal';
import SolanaLogo from '../../images/logos/solana.svg';

export function WalletEnvSelectionModal({ isOpen, close }: { isOpen: boolean; close: () => void }) {
  const { openConnectModal } = useConnectModal();

  const onClickEthereum = () => {
    openConnectModal?.();
    close();
  };

  const onClickSolana = () => {
    //TODO
    close();
  };

  return (
    <Modal title="Select Wallet Environment" isOpen={isOpen} close={close} width="max-w-sm">
      <div className="pt-4 pb-2 flex flex-col space-y-2.5">
        <EnvButton onClick={onClickEthereum} subTitle="an EVM" imgSrc={EthereumLogo}>
          Ethereum
        </EnvButton>
        <EnvButton onClick={onClickSolana} subTitle="a Solana" imgSrc={SolanaLogo}>
          Solana
        </EnvButton>
      </div>
    </Modal>
  );
}

function EnvButton({
  onClick,
  subTitle,
  imgSrc,
  children,
}: PropsWithChildren<{ subTitle: string; imgSrc: any; onClick?: () => void }>) {
  return (
    <button
      onClick={onClick}
      className="w-full py-6 space-y-2.5 flex flex-col items-center rounded-lg border border-gray-200 hover:bg-gray-100 hover:border-gray-200 active:bg-gray-200 transition-all"
    >
      <Image src={imgSrc} width={34} height={34} alt="" />
      <div className="uppercase text-gray-800 tracking-wide">{children}</div>
      <div className="text-sm text-gray-600">{`Connect to ${subTitle} compatible wallet`}</div>
    </button>
  );
}
