import Image from 'next/image';
import { PropsWithChildren } from 'react';

import EthereumLogo from '@hyperlane-xyz/sdk/logos/color/ethereum.svg';

import { Modal } from '../../components/layout/Modal';
import SolanaLogo from '../../images/logos/solana.svg';
import { ProtocolType } from '../chains/types';

import { useConnectFns } from './hooks';

export function WalletEnvSelectionModal({ isOpen, close }: { isOpen: boolean; close: () => void }) {
  const connectFns = useConnectFns();

  const onClickEnv = (env: ProtocolType) => () => {
    close();
    const connectFn = connectFns[env];
    if (connectFn) connectFn();
  };

  return (
    <Modal title="Select Wallet Environment" isOpen={isOpen} close={close} width="max-w-sm">
      <div className="pt-4 pb-2 flex flex-col space-y-2.5">
        <EnvButton
          onClick={onClickEnv(ProtocolType.Ethereum)}
          subTitle="an EVM"
          imgSrc={EthereumLogo}
        >
          Ethereum
        </EnvButton>
        <EnvButton
          onClick={onClickEnv(ProtocolType.Sealevel)}
          subTitle="a Solana"
          imgSrc={SolanaLogo}
        >
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
      <div className="text-sm text-gray-500">{`Connect to ${subTitle} compatible wallet`}</div>
    </button>
  );
}
